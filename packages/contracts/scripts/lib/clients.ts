import hre from "hardhat";
import type { HttpNetworkConfig } from "hardhat/types";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID } from "@agentrail/shared";

/// Order mirrors hardhat.config's baseSepoliaAccounts and the local chain, where
/// account #0 is both the deployer and Agent A. deploy.ts takes index 0 as the
/// deployer and seed.ts reads all three, so the order is load-bearing.
const TESTNET_KEY_NAMES = [
  "BASE_SEPOLIA_AGENT_A_PRIVATE_KEY",
  "BASE_SEPOLIA_AGENT_B_PRIVATE_KEY",
  "BASE_SEPOLIA_AGENT_C_PRIVATE_KEY",
] as const;

/// Wallet clients that sign transactions in-process instead of asking the node
/// to sign them.
///
/// hardhat-viem's own clients hold a JSON-RPC account, so viem sends
/// wallet_sendTransaction and only falls back to eth_sendTransaction when the
/// node rejects it with -32601 (method not found). Alchemy rejects unknown
/// methods with -32600 (invalid request) instead, which viem classifies as a
/// malformed request rather than a missing method — so the fallback never fires
/// and every write dies with "JSON is not a valid request object", pointing at
/// the request body rather than at the endpoint. A locally-signed transaction
/// goes out as eth_sendRawTransaction and never touches the wallet_ namespace,
/// so it works on any endpoint.
///
/// Local keeps hardhat-viem's clients: the Hardhat node answers -32601 properly,
/// so the fallback works, and the demo stays runnable with no keys configured.
export async function walletClients() {
  const chainId = await (await hre.viem.getPublicClient()).getChainId();
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) return hre.viem.getWalletClients();

  const keys = TESTNET_KEY_NAMES.map((name) => process.env[name]).filter(
    (key): key is string => Boolean(key),
  );
  if (keys.length < TESTNET_KEY_NAMES.length) {
    throw new Error(
      `Base Sepolia needs all of ${TESTNET_KEY_NAMES.join(", ")} set in the root .env`,
    );
  }

  // Whatever --network resolved to, so the endpoint cannot drift from the chain
  // this function just read the id from.
  const url = (hre.network.config as HttpNetworkConfig).url;

  return keys.map((key) =>
    createWalletClient({
      account: privateKeyToAccount(key as `0x${string}`),
      chain: baseSepolia,
      transport: http(url),
    }),
  );
}
