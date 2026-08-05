import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";
import type { Hex } from "viem";
import { CHAIN_ID, type DeliverableKind } from "@agentrail/shared";
import { accountFor, type AgentAccount } from "../lib/wallet.js";
import { query } from "./db.js";

/// The agents a user has created, and their keys.
///
/// Keyed by chain: an agent created against Base Sepolia has no identity on a
/// local chain, so the same store must not hand back an address that is
/// unregistered on whichever one is running.

export interface ServiceOffer {
  /// What the agent sells, in its own words — what a hiring agent reads, and
  /// what tells the provider itself what it is for when it comes to do the work.
  summary: string;
  priceUsdc: string;
  /// The form the work takes. Declared rather than inferred: the evaluator and
  /// the browser both have to know what they are looking at, and a client
  /// cannot know what a stranger's agent produces.
  ///
  /// Optional because rows written before this existed genuinely lack it — the
  /// service is stored as JSON, so an older agent has no such key. Absent means
  /// svg, which is what those agents produce. Declaring it required would make
  /// the type lie about what comes back from the database.
  deliverable?: DeliverableKind;
  /// The terms the evaluator grades against. Published, so a client adopts them
  /// verbatim and what was sold cannot drift from what is judged.
  requirements: string[];
}

export interface AgentRecord {
  id: string;
  name: string;
  /// A provider publishes a service and works jobs; a client only hires.
  role: "client" | "provider";
  service: ServiceOffer | null;
  /// Owner key. It signs; it never holds funds — the smart account does.
  privateKey: Hex;
  /// Smart account address: the agent's on-chain identity.
  address: `0x${string}`;
  chainId: number;
  /// Who created it. An opaque identifier the caller supplied — an address
  /// today, a verified identity later — never interpreted here.
  ///
  /// Null for agents created before ownership existed. Those stay usable by
  /// anyone rather than becoming unreachable, which is what lets ownership be
  /// added to a running system.
  createdBy: string | null;
  createdAt: string;
  /// When onboarding completed. Null means it did not: the agent holds no
  /// identity and no gas, so it cannot take a job.
  onboardedAt: string | null;
}

interface Row {
  id: string;
  name: string;
  role: "client" | "provider";
  service: ServiceOffer | null;
  private_key: string;
  address: string;
  chain_id: number;
  created_by: string | null;
  created_at: Date;
  onboarded_at: Date | null;
}

function toRecord(row: Row): AgentRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    service: row.service,
    privateKey: row.private_key as Hex,
    address: row.address as `0x${string}`,
    chainId: row.chain_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    onboardedAt: row.onboarded_at ? row.onboarded_at.toISOString() : null,
  };
}

const SELECT = `SELECT id, name, role, service, private_key, address, chain_id, created_by, created_at, onboarded_at
                  FROM $SCHEMA.agent`;

export async function listAgents(): Promise<AgentRecord[]> {
  const rows = await query<Row>(`${SELECT} WHERE chain_id = $1 ORDER BY created_at`, [CHAIN_ID]);
  return rows.map(toRecord);
}

export async function getAgent(id: string): Promise<AgentRecord | undefined> {
  const rows = await query<Row>(`${SELECT} WHERE chain_id = $1 AND id = $2`, [CHAIN_ID, id]);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

/// Slug derived from the name, so a URL reads as the agent a user named rather
/// than an opaque id. Collisions get a numeric suffix.
function slugFor(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "agent";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface CreateAgentInput {
  name: string;
  role: "client" | "provider";
  service?: ServiceOffer | null;
  /// Who is creating it. Omitted means unowned, which anyone may use.
  createdBy?: string | null;
}

/// May this caller act as this agent — hire with it, or talk to it?
///
/// Ownership is about acting, not about seeing. The directory stays public
/// because that is what discovery means: an agent finds a counterparty by
/// reading what everyone offers. What it must not do is spend someone else's
/// agent's money.
///
/// An agent with no owner predates ownership and stays open, so adding this
/// does not strand the agents already running.
export function mayActAs(record: AgentRecord, caller: string | null): boolean {
  if (record.createdBy === null) return true;
  if (caller === null) return false;
  return record.createdBy.toLowerCase() === caller.toLowerCase();
}

/// Mint a new agent: fresh keypair, derived smart account, persisted.
///
/// Deliberately does not touch the chain. Registering and funding is onboarding,
/// which needs a treasury and can fail for reasons unrelated to the record —
/// keeping them apart means a half-finished onboarding leaves an agent that can
/// be retried, not a lost key.
export async function createAgent(input: CreateAgentInput): Promise<AgentRecord> {
  const privateKey = generatePrivateKey();
  const account = await accountFor(privateKey);

  const existing = await listAgents();
  const id = slugFor(input.name, new Set(existing.map((a) => a.id)));
  const service = input.role === "provider" ? (input.service ?? null) : null;

  // The key is written before anything else happens to the agent, so a crash
  // during onboarding cannot lose it.
  const rows = await query<Row>(
    `INSERT INTO $SCHEMA.agent (id, chain_id, name, role, service, private_key, address, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, role, service, private_key, address, chain_id, created_by, created_at, onboarded_at`,
    [
      id,
      CHAIN_ID,
      input.name,
      input.role,
      service ? JSON.stringify(service) : null,
      privateKey,
      account.address,
      input.createdBy ?? null,
    ],
  );
  return toRecord(rows[0]!);
}

/// Record that an agent finished onboarding and can now take work.
export async function markOnboarded(id: string): Promise<void> {
  await query(`UPDATE $SCHEMA.agent SET onboarded_at = now() WHERE chain_id = $1 AND id = $2`, [
    CHAIN_ID,
    id,
  ]);
}

/// An agent that holds an identity and gas, and can therefore act. The directory
/// shows only these: a half-created agent advertising a service is a client
/// commissioning work that fails at createJob, having already been quoted.
export function isReady(record: AgentRecord): boolean {
  return record.onboardedAt !== null;
}

/// The live account for a stored agent, for signing and sending.
///
/// The address was recorded when the agent was created, so it is passed rather
/// than re-derived: the derivation is deterministic and the chain can only
/// answer with the value already stored here.
export function accountOf(record: AgentRecord): Promise<AgentAccount> {
  return accountFor(record.privateKey, record.address);
}

/// What a directory listing may show. Never the key — this shape is what the
/// HTTP layer returns, so the secret cannot leak by forgetting to strip it.
export interface PublicAgent {
  id: string;
  name: string;
  role: "client" | "provider";
  address: `0x${string}`;
  service: ServiceOffer | null;
  createdBy: string | null;
  createdAt: string;
  /// When onboarding completed. Null means it did not: the agent holds no
  /// identity and no gas, so it cannot take a job.
  onboardedAt: string | null;
}

export function toPublic(record: AgentRecord): PublicAgent {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    address: record.address,
    service: record.service,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    onboardedAt: record.onboardedAt,
  };
}

/// Move agents out of the file the runtime used before Postgres.
///
/// Worth doing rather than dropping: those agents hold registered on-chain
/// identities, and because the token is soulbound, losing the key orphans the
/// registration permanently. The file is left in place — deleting it would
/// destroy the only copy if the import were wrong.
export async function importLegacyFile(): Promise<number> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const legacyPath =
    process.env.AGENT_STORE_PATH ?? path.join(here, "..", "..", ".agents.json");

  let parsed: Record<string, AgentRecord[]>;
  try {
    parsed = JSON.parse(fs.readFileSync(legacyPath, "utf8")) as Record<string, AgentRecord[]>;
  } catch {
    return 0;
  }

  let imported = 0;
  for (const [chainId, records] of Object.entries(parsed)) {
    for (const record of records) {
      // ON CONFLICT DO NOTHING: importing twice must not fail, and the row
      // already in Postgres is the authoritative one.
      const rows = await query<{ id: string }>(
        `INSERT INTO $SCHEMA.agent (id, chain_id, name, role, service, private_key, address, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
           RETURNING id`,
        [
          record.id,
          Number(chainId),
          record.name,
          record.role,
          record.service ? JSON.stringify(record.service) : null,
          record.privateKey,
          record.address,
          record.createdAt ?? new Date().toISOString(),
        ],
      );
      if (rows.length > 0) imported += 1;
    }
  }
  return imported;
}
