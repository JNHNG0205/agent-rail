export interface CompletionRequest {
  system: string;
  user: string;
  /// Returned verbatim when LLM_PROVIDER=mock. Required so offline mode cannot rot.
  mock: string;
  maxTokens?: number;
}

export interface JsonCompletionRequest<T> {
  system: string;
  user: string;
  mock: T;
  maxTokens?: number;
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MAX_TOKENS = 4000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (required when LLM_PROVIDER=openrouter)`);
  }
  return value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChat(req: CompletionRequest): Promise<string> {
  const apiKey = requireEnv("LLM_API_KEY");
  const model = requireEnv("LLM_MODEL");
  const baseUrl = process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL;

  const body = JSON.stringify({
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  });

  let lastError = "";
  // One retry: transient 429/5xx and network blips are common on a shared key.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(1000);
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
  throw new Error(`LLM request failed after 2 attempts: ${lastError}`);
}

export async function complete(req: CompletionRequest): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? "mock";
  if (provider === "mock") return req.mock;
  return postChat(req);
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
  const provider = process.env.LLM_PROVIDER ?? "mock";
  if (provider === "mock") return req.mock;

  const base: CompletionRequest = {
    system: req.system,
    user: req.user,
    mock: JSON.stringify(req.mock),
    maxTokens: req.maxTokens,
  };

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user =
      attempt === 0
        ? base.user
        : `${base.user}\n\nYour previous reply was not valid JSON matching the required shape (${lastError}). Reply with the JSON object only.`;
    const raw = await postChat({ ...base, user });
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
