import { createWalletClient, createPublicClient, http, type Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createNonceManager, jsonRpc } from "viem/nonce";
import { toCoinbaseSmartAccount, createBundlerClient } from "viem/account-abstraction";
import { baseSepolia, hardhat } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, CHAIN_ID, RPC_URL } from "@agentrail/shared";

const chain = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? baseSepolia : hardhat;
const isTestnet = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID;

/// Public client for reads and log polling against the active chain.
export const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

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
async function smartAccountFor(privateKey: Hex): Promise<AgentAccount> {
  const owner = privateKeyToAccount(privateKey);
  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: "1",
  });
  // Alchemy serves the bundler on the same endpoint, so no second URL is needed.
  const bundler = createBundlerClient({ account, client: publicClient, transport: http(RPC_URL) });

  return {
    address: account.address,
    owner: owner.address,
    async send(calls) {
      const hash = await bundler.sendUserOperation({ calls });
      const receipt = await bundler.waitForUserOperationReceipt({ hash });
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
  const wallet = createWalletClient({ account: owner, chain, transport: http(RPC_URL) });

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

export function accountFor(privateKey: Hex): Promise<AgentAccount> {
  return isTestnet ? smartAccountFor(privateKey) : Promise.resolve(eoaAccountFor(privateKey));
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

// Deriving a smart account address is a network round trip, so each agent's is
// built once and shared. Without this every call site would pay for it again.
const cache = new Map<string, Promise<AgentAccount>>();

function agent(role: "A" | "B" | "C"): Promise<AgentAccount> {
  const key = keyFor(role);
  let existing = cache.get(key);
  if (!existing) {
    existing = accountFor(key);
    cache.set(key, existing);
  }
  return existing;
}

export const agentA = () => agent("A");
export const agentB = () => agent("B");

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
