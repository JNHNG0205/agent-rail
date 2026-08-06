import type { JobBrief } from "@agentrail/shared";
import { CHAIN_ID } from "@agentrail/shared";
import { query } from "./db.js";

/// Work in flight: the brief a provider was given, and the deliverable it made.
///
/// Both were held in a Map, on the reasoning that the chain holds the
/// authoritative hash and a restart losing the content is recoverable through
/// the timeout. Neither half of that survived contact with the system.
///
/// The deliverable is the thing that was paid for. Losing it does not fail the
/// job — the escrow settles on the hash, so the provider is paid and the client
/// has nothing — and no timeout recovers it, because the job already ended.
/// That is the worst shape a data loss can take: silent, permanent, and only
/// discovered by someone asking to see what they bought.
///
/// The brief is what the evaluator fetches before grading. Lose it and the
/// evaluator cannot rule at all, so the job sits in Submitted until it times
/// out — which is the mechanism working, but a full timeout of delay caused by
/// a process restart nobody noticed.
///
/// Keyed by chain and job, with the agent, so two agents cannot collide on a
/// job number and a local job cannot be mistaken for a testnet one.

export interface Work {
  brief: JobBrief | null;
  deliverable: string | null;
}

interface Row {
  brief: JobBrief | null;
  deliverable: string | null;
}

export async function rememberCommission(
  agentId: string,
  jobId: bigint,
  brief: JobBrief,
): Promise<void> {
  // ON CONFLICT: the brief may be handed over again — a client retrying after a
  // failed fund is the ordinary case — and the latest one is authoritative.
  await query(
    `INSERT INTO $SCHEMA.job_work (chain_id, job_id, agent_id, brief)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT (chain_id, job_id) DO UPDATE SET brief = EXCLUDED.brief`,
    [CHAIN_ID, jobId.toString(), agentId, JSON.stringify(brief)],
  );
}

export async function getCommission(
  agentId: string,
  jobId: bigint,
): Promise<JobBrief | undefined> {
  const rows = await query<Row>(
    `SELECT brief FROM $SCHEMA.job_work
      WHERE chain_id = $1 AND job_id = $2 AND agent_id = $3`,
    [CHAIN_ID, jobId.toString(), agentId],
  );
  return rows[0]?.brief ?? undefined;
}

export async function rememberDeliverable(
  agentId: string,
  jobId: bigint,
  deliverable: string,
): Promise<void> {
  // The row already exists — a deliverable only follows a commission — but the
  // insert branch keeps this usable on its own rather than depending on order.
  await query(
    `INSERT INTO $SCHEMA.job_work (chain_id, job_id, agent_id, deliverable)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT (chain_id, job_id) DO UPDATE SET deliverable = EXCLUDED.deliverable`,
    [CHAIN_ID, jobId.toString(), agentId, deliverable],
  );
}

export async function getDeliverable(
  agentId: string,
  jobId: bigint,
): Promise<string | undefined> {
  const rows = await query<Row>(
    `SELECT deliverable FROM $SCHEMA.job_work
      WHERE chain_id = $1 AND job_id = $2 AND agent_id = $3`,
    [CHAIN_ID, jobId.toString(), agentId],
  );
  return rows[0]?.deliverable ?? undefined;
}
