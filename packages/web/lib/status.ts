/// What a job's colour means. Member 4.
///
/// One mapping, in one place, because colour here is information rather than
/// decoration. The chain records four states and the indexer derives an outcome,
/// and those two together are the six things that can be true of a job. A person
/// scanning a list reads the hue before the word, so a hue used loosely once is
/// a hue that cannot be trusted anywhere.
///
/// `Terminal` is the reason this exists. On chain it collapses settled, refunded
/// and timed out into one value — the three outcomes a person most needs told
/// apart, since they are the difference between being paid, being refunded, and
/// taking the fee because nobody judged the work.

export type StatusKey =
  | "open"
  | "funded"
  | "submitted"
  | "settled"
  | "refunded"
  | "timeout";

export interface Status {
  key: StatusKey;
  label: string;
  /// What the state means for the money, in the fewest words that stay true.
  meaning: string;
}

const STATUS: Record<StatusKey, Status> = {
  open: { key: "open", label: "Open", meaning: "posted, nothing escrowed yet" },
  funded: { key: "funded", label: "Funded", meaning: "escrow locked, work under way" },
  submitted: { key: "submitted", label: "Submitted", meaning: "delivered, awaiting a verdict" },
  settled: { key: "settled", label: "Settled", meaning: "approved — paid to the provider" },
  refunded: { key: "refunded", label: "Refunded", meaning: "rejected — returned to the client" },
  timeout: { key: "timeout", label: "Timed out", meaning: "no verdict — the provider claimed it" },
};

export type JobOutcome = "completed" | "cancelled" | "timeoutClaimed" | null;

/// The status of a job, from the chain's state and the indexer's outcome.
///
/// An unknown outcome on a terminal job resolves to settled rather than
/// throwing: the job is over and paid or refunded either way, and a list that
/// renders nothing is worse than one that renders the common case.
export function statusOf(state: number, outcome: JobOutcome): Status {
  if (state === 0) return STATUS.open;
  if (state === 1) return STATUS.funded;
  if (state === 2) return STATUS.submitted;
  if (outcome === "cancelled") return STATUS.refunded;
  if (outcome === "timeoutClaimed") return STATUS.timeout;
  return STATUS.settled;
}

export function statusByKey(key: StatusKey): Status {
  return STATUS[key];
}

export const STATUS_KEYS: readonly StatusKey[] = [
  "open",
  "funded",
  "submitted",
  "settled",
  "refunded",
  "timeout",
];
