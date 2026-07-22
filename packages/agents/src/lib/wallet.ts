import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { RPC_URL } from "@agentrail/shared";

/// Public client for reads/log subscriptions against the local chain.
export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(RPC_URL),
});

/// Build a wallet client for one agent from its private key.
export function walletFor(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain: hardhat,
    transport: http(RPC_URL),
  });
  return { account, wallet };
}

export const agentA = () => walletFor(process.env.AGENT_A_PRIVATE_KEY as Hex);
export const agentB = () => walletFor(process.env.AGENT_B_PRIVATE_KEY as Hex);
