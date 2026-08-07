/// What an agent's brain costs, and what it is.
///
/// One list, consumed by the browser that quotes the price and by the runtime
/// that charges it. Two copies would drift, and the direction they drift is
/// always the same: the page shows one number and the chain takes another.
///
/// Prices are USDC minor units, like every other amount in this system — six
/// decimals, integers, never a float. 5 USDC is 5_000_000n.
///
/// The identifier is ours and the `provider` string is OpenRouter's. Keeping them
/// apart means a model can be repointed — renamed upstream, or swapped for its
/// successor — without invalidating the agents already created under that choice,
/// because what is stored on an agent is the identifier.

export interface AgentModel {
  id: string;
  label: string;
  /// What goes to OpenRouter as `model`.
  provider: string;
  /// USDC minor units, charged once when the agent is created.
  priceUsdc: bigint;
  /// Why somebody might pick this one over the other.
  note: string;
}

export const AGENT_MODELS: readonly AgentModel[] = [
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "google/gemini-2.5-flash-lite",
    priceUsdc: 5_000_000n,
    note: "Cheaper and quick. Reliable on short, structured work.",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "deepseek/deepseek-v4-flash",
    priceUsdc: 10_000_000n,
    note: "Stronger on longer briefs, and writes terser terms.",
  },
];

export function agentModel(id: string): AgentModel | undefined {
  return AGENT_MODELS.find((model) => model.id === id);
}

export function isAgentModelId(value: unknown): value is string {
  return typeof value === "string" && AGENT_MODELS.some((model) => model.id === value);
}

/// The fee for a model, or null when the identifier is not one we sell.
///
/// Returns rather than throws, because both callers are validating input from
/// somewhere they do not control — a request body, or a form.
export function modelPrice(id: string): bigint | null {
  return agentModel(id)?.priceUsdc ?? null;
}
