import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, CHAIN_ID, RPC_URL } from "@agentrail/shared";

const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;

/// Public client for reads/log subscriptions against the active chain.
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

/// Build a wallet client for one agent from its private key.
export function walletFor(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
  return { account, wallet };
}

/// Which env var holds an agent's key depends on the chain, deliberately.
///
/// The local AGENT_*_PRIVATE_KEY values are Hardhat's published accounts — their
/// keys are in Hardhat's own docs, so anything sent to those addresses on a
/// public network is swept within seconds. Selecting the variable by chain makes
/// it impossible to point the local keys at Base Sepolia by forgetting to swap a
/// value, and avoids keeping the same secret under two names.
function keyFor(agent: "A" | "B" | "C"): Hex {
  const prefix = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? "BASE_SEPOLIA_" : "";
  const name = `${prefix}AGENT_${agent}_PRIVATE_KEY`;
  const key = process.env[name];
  if (!key) {
    throw new Error(`${name} is not set (required for chain ${CHAIN_ID})`);
  }
  return key as Hex;
}

export const agentA = () => walletFor(keyFor("A"));
export const agentB = () => walletFor(keyFor("B"));
export const agentC = () => walletFor(keyFor("C"));
