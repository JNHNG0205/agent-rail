import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import { RPC_URL } from "@agentrail/shared";

/// Public client for reading live chain state from the browser/server. The web
/// app reads live state via viem AND indexed history via /api routes. Member 3.
export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(RPC_URL),
});
