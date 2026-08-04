import { createPublicClient, http } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, CHAIN_ID, RPC_URL } from "@agentrail/shared";

/// Public client for reading live chain state from the browser/server. The web
/// app reads live state via viem AND indexed history via /api routes. Member 3.
/// CHAIN_ID resolves from NEXT_PUBLIC_CHAIN_ID and defaults to local.
const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});
