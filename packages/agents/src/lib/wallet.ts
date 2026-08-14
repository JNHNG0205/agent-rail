import {
  createWalletClient,
  createPublicClient,
  fallback,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";
import { toCoinbaseSmartAccount, createBundlerClient } from "viem/account-abstraction";
import { baseSepolia, hardhat } from "viem/chains";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_RPC_URL,
  CHAIN_ID,
  RPC_URL,
} from "@agentrail/shared";

const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;
const isTestnet = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID;

/// Public client for reads and log polling against the active chain.
/// One transport for every client here, with a backoff that matches how a
/// shared endpoint actually fails.
///
/// viem retries a 429 already, but three times at 150ms — all four attempts land
/// inside a second, which is no help when the endpoint is saturated for seconds
/// at a time. Creating an agent is the operation that feels it: it must ask the
/// factory for an address it cannot yet know, and that one call failing aborts
/// an onboarding that has already generated a key.
///
/// The delays are exponential from this base, so the last attempt is tens of
/// seconds out. That is the right trade here — registering an agent already
/// takes a minute, and waiting is better than losing the attempt.
const rpcTransport = http(RPC_URL, { retryCount: 6, retryDelay: 500 });

/// Reads fall back to the public endpoint when the configured one refuses.
///
/// The configured endpoint comes first and stays the normal path, because the
/// public pool is load balanced and answers from nodes that have not caught up —
/// stale state and missing blocks, which is where several of this project's
/// hardest bugs came from. It is the worse endpoint, and it is still far better
/// than no endpoint: a throttled key otherwise fails an operation outright, and
/// a read that lags by a block is recoverable where a failed onboarding is not.
///
/// Only reads. Bundling stays on the configured endpoint alone, because the
/// public one does not implement the method at all and answers "rpc method is
/// unsupported" — falling back there would turn a rate limit into a hard error.
const readTransport =
  isTestnet && RPC_URL !== BASE_SEPOLIA_RPC_URL
    ? fallback([rpcTransport, http(BASE_SEPOLIA_RPC_URL, { retryCount: 3, retryDelay: 500 })])
    : rpcTransport;

export const publicClient = createPublicClient({ chain, transport: readTransport });

/// One call an agent wants to make. Several can go in a single send.
export interface Call {
  to: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

/// An agent's on-chain presence.
///
/// `address` is what the contracts see — the smart account on testnet, the EOA
/// locally. It is the address to register in IdentityRegistry and to name as a
/// job's client or provider. `owner` only ever signs; it holds nothing.
export interface AgentAccount {
  address: `0x${string}`;
  owner: `0x${string}`;
  /// Execute calls and resolve once they are on chain. Every call in one
  /// invocation succeeds or fails together on testnet.
  send: (calls: Call[]) => Promise<Hex>;
  /// Sign a digest as this agent. Only the EOA path supports it — see agentC.
  signDigest: (digest: Hex) => Promise<Hex>;
}

/// ERC-4337: the agent is a smart account, and its owner key only signs.
///
/// Batching is the reason, not fashion. A job needs createJob, approve and
/// fundJob, and sent as separate transactions they race the endpoint: approve is
/// mined but the node estimating fundJob has not applied that block, so
/// transferFrom would fail against a zero allowance and estimation reverts. As
/// one UserOperation there is no window between them at all — the failure mode
/// stops existing rather than being retried.
///
/// The account also becomes the agent's identity. Registering the smart account
/// rather than the EOA means an agent is an account, which is what lets a user
/// create one without ever handling a key.
async function smartAccountFor(
  privateKey: Hex,
  knownAddress?: `0x${string}`,
): Promise<AgentAccount> {
  const owner = privateKeyToAccount(privateKey);
  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: "1",
    // Supplying the address skips a call to the factory's getAddress. The
    // derivation is deterministic — same owner, same nonce, same address for
    // ever — so an address recorded when the agent was created is still correct,
    // and asking the chain to recompute it is a round trip that can only return
    // what we already know. It was answering that question on every operation,
    // for every agent, until the endpoint started refusing with 429.
    ...(knownAddress ? { address: knownAddress } : {}),
  });
  // Alchemy serves the bundler on the configured RPC endpoint.
  // We use rpcTransport directly so bundler methods (eth_sendUserOperation,
  // eth_getUserOperationReceipt) are never routed to the public fallback endpoint
  // which does not implement bundler RPC methods.
  const bundler = createBundlerClient({ account, client: publicClient, transport: rpcTransport });

  return {
    address: account.address,
    owner: owner.address,
    async send(calls) {
      const hash = await bundler.sendUserOperation({ calls });
      // A generous timeout, because a bundler is a queue and not a chain.
      const receipt = await bundler.waitForUserOperationReceipt({
        hash,
        timeout: 180_000,
        pollingInterval: 3_000,
      });
      if (!receipt.success) {
        throw new Error(`user operation reverted (tx ${receipt.receipt.transactionHash})`);
      }
      return receipt.receipt.transactionHash;
    },
    signDigest() {
      // A smart account signs per ERC-1271, which a contract verifies by calling
      // isValidSignature — it cannot be recovered with ECDSA. Nothing here needs
      // it, and returning an ECDSA signature from the owner would be a lie: the
      // recovered address would be the owner, not this account.
      return Promise.reject(
        new Error("a smart account cannot produce an ECDSA signature — see agentC"),
      );
    },
  };
}

/// Track each account's nonce in process instead of asking the endpoint per
/// transaction. Only the local path needs this: a pooled endpoint answers
/// eth_getTransactionCount from a node that may not have applied the previous
/// block, handing back a nonce already spent. Smart accounts sidestep it, since
/// the EntryPoint owns their nonce.
const nonceManager = createNonceManager({ source: jsonRpc() });

/// Plain EOA, for the local Hardhat chain — it has no EntryPoint or account
/// factory deployed, so there is nothing to bundle against. Calls run in
/// sequence rather than atomically, which is safe locally because a single node
/// answers every request and cannot lag behind itself.
function eoaAccountFor(privateKey: Hex): AgentAccount {
  const owner = privateKeyToAccount(privateKey, { nonceManager });
  const wallet = createWalletClient({ account: owner, chain, transport: readTransport });

  return {
    address: owner.address,
    owner: owner.address,
    async send(calls) {
      let last: Hex = "0x";
      for (const call of calls) {
        const hash = await wallet.writeContract({
          address: call.to,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        } as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error(`${call.functionName} reverted (tx ${hash})`);
        }
        last = hash;
      }
      return last;
    },
    signDigest: (digest) => owner.signMessage({ message: { raw: digest } }),
  };
}

// Built once per key and shared. This used to sit further down and served only
// the three legacy agents, so every agent the runtime hosts re-derived its
// address on each call — the single largest source of RPC traffic in the system,
// and all of it recomputing a constant.
const accounts = new Map<string, Promise<AgentAccount>>();

export function accountFor(
  privateKey: Hex,
  knownAddress?: `0x${string}`,
): Promise<AgentAccount> {
  if (!isTestnet) return Promise.resolve(eoaAccountFor(privateKey));

  let existing = accounts.get(privateKey);
  if (!existing) {
    existing = smartAccountFor(privateKey, knownAddress).catch((err: unknown) => {
      // A failure must not be cached. A rate limit or a dropped connection is
      // temporary, and a rejected promise left in the map would make it
      // permanent for the lifetime of the process.
      accounts.delete(privateKey);
      throw err;
    });
    accounts.set(privateKey, existing);
  }
  return existing;
}

/// Which env var holds an agent's key depends on the chain, deliberately.
///
/// The local AGENT_*_PRIVATE_KEY values are Hardhat's published accounts — their
/// keys are in Hardhat's own docs, so anything sent to those addresses on a
/// public network is swept within seconds. Selecting the variable by chain makes
/// it impossible to point the local keys at Base Sepolia by forgetting to swap a
/// value, and avoids keeping the same secret under two names.
function keyFor(agent: "A" | "B" | "C"): Hex {
  const prefix = isTestnet ? "BASE_SEPOLIA_" : "";
  const name = `${prefix}AGENT_${agent}_PRIVATE_KEY`;
  const key = process.env[name];
  if (!key) throw new Error(`${name} is not set (required for chain ${CHAIN_ID})`);
  return key as Hex;
}

function agent(role: "A" | "B" | "C"): Promise<AgentAccount> {
  // accountFor caches, so this no longer keeps a second map of its own.
  return accountFor(keyFor(role));
}


/// The evaluator stays an EOA on every chain, unlike the other two.
///
/// EvaluatorModule verifies its decision with ECDSA.recover and compares the
/// result to job.evaluator. That recovers the EOA that signed. A smart account
/// signs per ERC-1271 instead — there is no key to recover — so recovery would
/// return some other address and the module would reject every verdict with
/// NotAuthorizedEvaluator, stranding each escrow until its timeout.
///
/// Supporting a smart-account evaluator means teaching EvaluatorModule
/// ERC-1271, which is a contract change and a redeploy.
export const agentC = () => Promise.resolve(eoaAccountFor(keyFor("C")));
