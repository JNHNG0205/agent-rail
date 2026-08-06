// Chain + protocol constants shared across every package.

export const LOCAL_CHAIN_ID = 31337;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const LOCAL_RPC_URL = "http://127.0.0.1:8545";
export const BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

/// Chain metadata for logging and explorer links. Local has no explorer.
export const CHAIN_META: Record<number, { name: string; explorer: string | null }> = {
  [LOCAL_CHAIN_ID]: { name: "Hardhat local", explorer: null },
  [BASE_SEPOLIA_CHAIN_ID]: { name: "Base Sepolia", explorer: "https://sepolia.basescan.org" },
};

// `process` is absent in some bundler targets, and Next.js only inlines
// NEXT_PUBLIC_* vars for LITERAL `process.env.X` member access — reading them
// via a variable or dynamic key would silently yield undefined in the browser.
const hasProcessEnv = typeof process !== "undefined" && typeof process.env === "object";

const rawChainId = hasProcessEnv
  ? process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID
  : undefined;

const parsedChainId = Number(rawChainId);

/// Active chain. Defaults to local so the demo path needs no configuration.
export const CHAIN_ID = Number.isInteger(parsedChainId) && parsedChainId > 0
  ? parsedChainId
  : LOCAL_CHAIN_ID;

/// The endpoint is chosen by the active chain rather than read from one shared
/// variable, so switching chains takes CHAIN_ID alone.
///
/// A single RPC_URL made the two settings independent, and a mismatch stayed
/// invisible until a write: viem signs for CHAIN_ID, the node rejects a foreign
/// chain id, and the only clue is "invalid chain ID" against a stack of decoded
/// call data. Reading a per-chain variable makes that state unreachable, and
/// reuses the names the indexer already reads.
const rawRpcUrl = !hasProcessEnv
  ? undefined
  : CHAIN_ID === BASE_SEPOLIA_CHAIN_ID
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL
    : process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL;

export const RPC_URL =
  rawRpcUrl || (CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? BASE_SEPOLIA_RPC_URL : LOCAL_RPC_URL);

export const CHAIN_NAME = CHAIN_META[CHAIN_ID]?.name ?? `chain ${CHAIN_ID}`;

export const USDC_DECIMALS = 6;

/// Blocks after which an unsettled job may be cancelled/refunded (demo value).
export const JOB_TIMEOUT_BLOCKS = 100;

/// Format USDC minor units (bigint) to a human string. Never route the raw
/// value through Number before scaling — 6-decimal money must stay integer.
/// A decimal USDC string to minor units.
///
/// Never through Number: a float cannot hold every 6-decimal value exactly, and
/// the error lands in money. `Number("0.07") * 1e6` is 70000.00000000001, which
/// rounds back only because the amounts here are small — that is luck, not a
/// property. This splits on the point and does integer arithmetic.
///
/// Throws rather than coercing. A price that cannot be represented is a
/// mistake worth surfacing where it is written, not silently truncated into an
/// escrow amount.
export function parseUsdc(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error(
      `"${value}" is not a USDC amount — expected a positive decimal with at most ${USDC_DECIMALS} places`,
    );
  }
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole!) * 10n ** BigInt(USDC_DECIMALS) + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

export function formatUsdc(minorUnits: bigint): string {
  const base = 10n ** BigInt(USDC_DECIMALS);
  const whole = minorUnits / base;
  const frac = (minorUnits % base).toString().padStart(USDC_DECIMALS, "0");
  return `${whole.toString()}.${frac}`;
}
