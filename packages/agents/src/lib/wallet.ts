import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";
import { baseSepolia, hardhat } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, CHAIN_ID, RPC_URL } from "@agentrail/shared";

const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;

/// Track each account's nonce in process instead of asking the endpoint per
/// transaction.
///
/// viem derives a nonce from eth_getTransactionCount for every write. A public
/// endpoint is a pool of nodes, so that read can be answered by one that has not
/// applied the block holding the previous transaction — it returns a nonce
/// already spent, and the node rejects the second transaction as "replacement
/// transaction underpriced". Agent A hit this reliably on Base Sepolia, where
/// createJob, approve and fundJob go out back to back: the job was created, then
/// approve came back with the same nonce and the run died holding an unfunded
/// job.
///
/// One manager shared by all three agents is correct — it keys by address, and
/// each agent has its own.
const nonceManager = createNonceManager({ source: jsonRpc() });

/// Public client for reads/log subscriptions against the active chain.
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

/// Build a wallet client for one agent from its private key.
export function walletFor(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey, { nonceManager });
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
