import hre from "hardhat";
import type { HttpNetworkConfig } from "hardhat/types";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID } from "@agentrail/shared";

/// Order mirrors hardhat.config's baseSepoliaAccounts and the local chain: index
/// 0 is the deployer, 1-3 are agents A, B and C. deploy.ts takes index 0 and
/// seed.ts reads 1-3, so the order is load-bearing.
const TESTNET_KEY_NAMES = [
  "BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY",
  "BASE_SEPOLIA_AGENT_A_PRIVATE_KEY",
  "BASE_SEPOLIA_AGENT_B_PRIVATE_KEY",
  "BASE_SEPOLIA_AGENT_C_PRIVATE_KEY",
] as const;

interface NonceReader {
  getTransactionCount: (a: {
    address: `0x${string}`;
    blockTag: "latest" | "pending";
  }) => Promise<number>;
}

/// Hand out nonces from a local counter instead of asking the endpoint each time.
///
/// viem derives a nonce per transaction from eth_getTransactionCount. Against a
/// pool of nodes that read can come from one that has not applied the latest
/// block, so it returns a nonce a mined transaction already used — and the node
/// rejects the second transaction as "replacement transaction underpriced", an
/// error about the collision that says nothing about the lag that caused it. It
/// struck a different call on each run, which made it look like several unrelated
/// bugs. Waiting for receipts does not help, because the receipt and the nonce
/// read can come from different nodes.
///
/// Counting locally is correct because the caller is the account's only sender
/// for the duration, and it is strictly better than any retry: the sequence
/// cannot collide in the first place.
export async function nonceSequencer(
  publicClient: NonceReader,
  address: `0x${string}`,
): Promise<() => number> {
  // Two agreeing reads, so the starting point is not itself taken from a lagging
  // node. latest === pending additionally means nothing is still in flight from
  // an aborted earlier run.
  let agreed = -1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const [latest, pending] = await Promise.all([
      publicClient.getTransactionCount({ address, blockTag: "latest" }),
      publicClient.getTransactionCount({ address, blockTag: "pending" }),
    ]);
    if (latest === pending && latest === agreed) {
      let next = latest;
      return () => next++;
    }
    agreed = latest === pending ? latest : -1;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(
    `could not settle on a starting nonce for ${address} — transactions may still be in flight`,
  );
}

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
      // viem's http transport retries a failed request three times by default,
      // which is wrong for eth_sendRawTransaction: a submission whose response is
      // slow or dropped has still reached the mempool, so the retry re-sends an
      // identical signed transaction and the node rejects it as "replacement
      // transaction underpriced". That surfaced as a deploy failing on a random
      // wiring call while the transaction it complained about had in fact been
      // accepted. Sending once means a failure is a real failure.
      transport: http(url, { retryCount: 0 }),
    }),
  );
}
