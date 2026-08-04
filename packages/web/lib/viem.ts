import { createPublicClient, createWalletClient, http, custom } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, CHAIN_ID, RPC_URL } from "@agentrail/shared";

/// Public client for reading live chain state from the browser/server. The web
/// app reads live state via viem AND indexed history via /api routes. Member 3.
/// CHAIN_ID resolves from NEXT_PUBLIC_CHAIN_ID and defaults to local.
export const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

/// Create a wallet client for browser environment. For local Hardhat (31337)
/// development, http(RPC_URL) is used directly to bypass browser extension chain ID mismatches.
export function getWalletClient(account?: `0x${string}`) {
  // For local development on Hardhat node, use direct HTTP transport
  // so transactions bypass browser extension network mismatches (e.g. Chain 999 vs 31337).
  if (chain.id === hardhat.id) {
    return createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });
  }

  if (typeof window !== "undefined" && (window as unknown as { ethereum?: unknown }).ethereum) {
    return createWalletClient({
      account,
      chain,
      transport: custom((window as unknown as { ethereum: unknown }).ethereum as never),
    });
  }

  return createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  });
}
