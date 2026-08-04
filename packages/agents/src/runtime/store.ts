import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";
import type { Hex } from "viem";
import { CHAIN_ID } from "@agentrail/shared";
import { accountFor, type AgentAccount } from "../lib/wallet.js";
import { query } from "./db.js";

/// The agents a user has created, and their keys.
///
/// Keyed by chain: an agent created against Base Sepolia has no identity on a
/// local chain, so the same store must not hand back an address that is
/// unregistered on whichever one is running.

export interface ServiceOffer {
  /// What the agent sells, in its own words — what a hiring agent reads.
  summary: string;
  priceUsdc: string;
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
  createdAt: string;
}

interface Row {
  id: string;
  name: string;
  role: "client" | "provider";
  service: ServiceOffer | null;
  private_key: string;
  address: string;
  chain_id: number;
  created_at: Date;
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
    createdAt: row.created_at.toISOString(),
  };
}

const SELECT = `SELECT id, name, role, service, private_key, address, chain_id, created_at
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
    `INSERT INTO $SCHEMA.agent (id, chain_id, name, role, service, private_key, address)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, role, service, private_key, address, chain_id, created_at`,
    [id, CHAIN_ID, input.name, input.role, service ? JSON.stringify(service) : null, privateKey, account.address],
  );
  return toRecord(rows[0]!);
}

/// The live account for a stored agent, for signing and sending.
export function accountOf(record: AgentRecord): Promise<AgentAccount> {
  return accountFor(record.privateKey);
}

/// What a directory listing may show. Never the key — this shape is what the
/// HTTP layer returns, so the secret cannot leak by forgetting to strip it.
export interface PublicAgent {
  id: string;
  name: string;
  role: "client" | "provider";
  address: `0x${string}`;
  service: ServiceOffer | null;
  createdAt: string;
}

export function toPublic(record: AgentRecord): PublicAgent {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    address: record.address,
    service: record.service,
    createdAt: record.createdAt,
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
