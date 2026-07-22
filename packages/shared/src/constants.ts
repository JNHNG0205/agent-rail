// Chain + protocol constants shared across every package.

export const CHAIN_ID = 31337; // Hardhat local
export const RPC_URL = "http://127.0.0.1:8545";

export const USDC_DECIMALS = 6;

/// Blocks after which an unsettled job may be cancelled/refunded (demo value).
export const JOB_TIMEOUT_BLOCKS = 100;

/// Format USDC minor units (bigint) to a human string. Never route the raw
/// value through Number before scaling — 6-decimal money must stay integer.
export function formatUsdc(minorUnits: bigint): string {
  const base = 10n ** BigInt(USDC_DECIMALS);
  const whole = minorUnits / base;
  const frac = (minorUnits % base).toString().padStart(USDC_DECIMALS, "0");
  return `${whole.toString()}.${frac}`;
}
