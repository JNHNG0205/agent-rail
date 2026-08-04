import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";
import type { Hex } from "viem";
import { CHAIN_ID } from "@agentrail/shared";
import { accountFor, type AgentAccount } from "../lib/wallet.js";

/// The agents a user has created, and their keys.
///
/// This must survive a restart. An identity token is soulbound, so an agent's
/// address is permanent — lose its key and the registration is orphaned, with no
/// way to mint another for that address or to move the one it holds. Keeping
/// them in memory would burn a fresh on-chain identity on every restart.
///
/// Keyed by chain, because an agent created against Base Sepolia has no identity
/// on a local chain and vice versa: the same file must not hand back an address
/// that is unregistered on whichever chain is running.

const here = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.AGENT_STORE_PATH ?? path.join(here, "..", "..", ".agents.json");

export interface ServiceOffer {
  /// What the agent sells, in its own words — this is what a hiring agent reads.
  summary: string;
  priceUsdc: string;
  /// The terms the evaluator will grade against. Published, so a client adopts
  /// them verbatim and what was sold cannot drift from what is judged.
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

type StoreFile = Record<string, AgentRecord[]>;

function readFile(): StoreFile {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as StoreFile;
  } catch {
    return {};
  }
}

function writeFile(data: StoreFile): void {
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

export function listAgents(): AgentRecord[] {
  return readFile()[String(CHAIN_ID)] ?? [];
}

export function getAgent(id: string): AgentRecord | undefined {
  return listAgents().find((a) => a.id === id);
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
/// which needs a treasury and can fail for reasons that have nothing to do with
/// the record — keeping them apart means a half-finished onboarding leaves an
/// agent that can be retried, not a lost key.
export async function createAgent(input: CreateAgentInput): Promise<AgentRecord> {
  const privateKey = generatePrivateKey();
  const account = await accountFor(privateKey);

  const data = readFile();
  const key = String(CHAIN_ID);
  const existing = data[key] ?? [];

  const record: AgentRecord = {
    id: slugFor(input.name, new Set(existing.map((a) => a.id))),
    name: input.name,
    role: input.role,
    service: input.role === "provider" ? (input.service ?? null) : null,
    privateKey,
    address: account.address,
    chainId: CHAIN_ID,
    createdAt: new Date().toISOString(),
  };

  data[key] = [...existing, record];
  writeFile(data);
  return record;
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
