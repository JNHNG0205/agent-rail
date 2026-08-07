export interface CompletionRequest {
  system: string;
  user: string;
  /// Returned verbatim when LLM_PROVIDER=mock. Required so offline mode cannot rot.
  mock: string;
  maxTokens?: number;
  /// The model to answer with, when the caller has one of its own.
  ///
  /// A provider agent is created against a model its owner paid for, so its work
  /// has to go to that model rather than to whatever LLM_MODEL happens to say.
  /// Omitted falls back to the configured default, which is right for everything
  /// nobody bought: the assistant, and the evaluator.
  model?: string;
}

export interface JsonCompletionRequest<T> {
  system: string;
  user: string;
  mock: T;
  maxTokens?: number;
  /// The model to answer with. See CompletionRequest.
  model?: string;
  /// JSON Schema describing the reply, sent to OpenRouter as a structured
  /// output. Without it the model is merely asked for JSON in the prompt and may
  /// return prose, a fenced block or a differently shaped object — which for
  /// Agent C means no verdict and an escrow left hanging until the timeout.
  ///
  /// OpenRouter requires strict schemas to list every property in `required` and
  /// set `additionalProperties: false`; schemaName labels it in the request.
  schema?: JsonSchema;
  schemaName?: string;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MAX_TOKENS = 4000;

type Provider = "mock" | "openrouter";

/// Trims and lowercases before comparing so `Mock`, `MOCK`, or a trailing space cannot
/// silently take the network path — that mismatch is the exact demo-day failure mock mode
/// exists to prevent. Unset still defaults to "mock".
function resolveProvider(): Provider {
  const raw = process.env.LLM_PROVIDER;
  if (raw === undefined) return "mock";
  const normalised = raw.trim().toLowerCase();
  if (normalised === "" || normalised === "mock") return "mock";
  if (normalised === "openrouter") return "openrouter";
  throw new Error(
    `LLM_PROVIDER must be "mock" or "openrouter" (got ${JSON.stringify(raw)})`,
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (required when LLM_PROVIDER=openrouter)`);
  }
  return value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChat(
  req: CompletionRequest,
  schema?: { name: string; schema: JsonSchema },
): Promise<string> {
  const apiKey = requireEnv("LLM_API_KEY");
  const model = req.model ?? requireEnv("LLM_MODEL");
  const baseUrl = process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL;

  const body = JSON.stringify({
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    ...(schema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: schema.name, strict: true, schema: schema.schema },
          },
          // Route only to endpoints that actually implement structured outputs.
          // A model can list support while an individual provider serving it does
          // not, and OpenRouter would otherwise silently pick that provider.
          provider: { require_parameters: true },
        }
      : {}),
  });

  let lastError = "";
  // Four attempts, backing off. Two was set against transient 429s and network
  // blips, which usually clear on the next try. It is not enough for the other
  // failure seen here: a 200 whose content is simply empty. OpenRouter routes a
  // model across several upstream providers, so one that answers this way is
  // retried onto a different one — but a quarter of measured calls failed at two
  // attempts a second apart, and each of those is an agent that could not be
  // created or a funded job that had to wait for the timeout.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body,
      });
      if (!res.ok) {
        lastError = `${res.status} ${res.statusText}`;
        continue;
      }
      const json = (await res.json()) as ChatCompletion;
      const text = json.choices?.[0]?.message?.content;
      if (!text) {
        lastError = "response contained no content";
        continue;
      }
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`LLM request failed after 4 attempts: ${lastError}`);
}

export async function complete(req: CompletionRequest): Promise<string> {
  const provider = resolveProvider();
  if (provider === "mock") return req.mock;
  return postChat(req);
}

/// complete(), retrying once when the reply fails `valid`.
///
/// The JSON path has always retried a badly shaped reply; free-text callers had
/// no equivalent and threw on the first attempt. That asymmetry was expensive
/// rather than untidy: Agent B generates its SVG only after the job is funded,
/// so one malformed generation left real escrow stranded until the timeout, and
/// models do return truncated output — observed with finish_reason "stop" and
/// well under the token limit, so it is the model stopping early, not a cut-off
/// this code can prevent.
///
/// `describe` is fed back on the retry so the second attempt is told what was
/// wrong with the first.
export async function completeValidated(
  req: CompletionRequest,
  valid: (value: string) => boolean,
  describe: string,
  transform: (raw: string) => string = (raw) => raw,
): Promise<string> {
  const provider = resolveProvider();
  if (provider === "mock") {
    const value = transform(req.mock);
    // Same reasoning as completeJson: validating the mock here is what stops
    // offline mode drifting away from what the network path accepts.
    if (!valid(value)) throw new Error("completeValidated: the mock value is not valid");
    return value;
  }

  let last = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user =
      attempt === 0
        ? req.user
        : `${req.user}\n\nYour previous reply was rejected: ${describe}. Reply with the complete document only.`;
    const value = transform(await postChat({ ...req, user }));
    if (valid(value)) return value;
    last = value.slice(0, 80);
  }
  throw new Error(`${describe} after 2 attempts (last reply began: ${last})`);
}

/// Models often wrap JSON or SVG in markdown fences despite instructions.
export function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:[a-zA-Z]+)?\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export async function completeJson<T>(
  req: JsonCompletionRequest<T>,
  guard: (value: unknown) => value is T,
): Promise<T> {
  const provider = resolveProvider();
  if (provider === "mock") {
    // The mock is a required field precisely so offline mode cannot rot — running the same
    // guard the network path uses here is what enforces that.
    if (!guard(req.mock)) {
      throw new Error("completeJson: the mock value does not satisfy its own guard");
    }
    return req.mock;
  }

  const base: CompletionRequest = {
    system: req.system,
    user: req.user,
    mock: JSON.stringify(req.mock),
    maxTokens: req.maxTokens,
    model: req.model,
  };

  const structured = req.schema
    ? { name: req.schemaName ?? "response", schema: req.schema }
    : undefined;

  let lastError = "";
  // The schema makes a malformed reply unlikely rather than impossible — a
  // provider can still return prose on an error path — so the parse, the guard
  // and the corrective retry all stay.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user =
      attempt === 0
        ? base.user
        : `${base.user}\n\nYour previous reply was not valid JSON matching the required shape (${lastError}). Reply with the JSON object only.`;
    const raw = await postChat({ ...base, user }, structured);
    try {
      const parsed: unknown = JSON.parse(stripFences(raw));
      if (guard(parsed)) return parsed;
      lastError = "shape did not match";
    } catch (err) {
      lastError = err instanceof Error ? err.message : "parse error";
    }
  }
  throw new Error(`LLM JSON response did not match the expected shape: ${lastError}`);
}
