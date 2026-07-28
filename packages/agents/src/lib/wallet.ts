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

function keyFor(name: string): Hex {
  const key = process.env[name];
  if (!key) throw new Error(`${name} is not set`);
  return key as Hex;
}

export const agentA = () => walletFor(keyFor("AGENT_A_PRIVATE_KEY"));
export const agentB = () => walletFor(keyFor("AGENT_B_PRIVATE_KEY"));
export const agentC = () => walletFor(keyFor("AGENT_C_PRIVATE_KEY"));
