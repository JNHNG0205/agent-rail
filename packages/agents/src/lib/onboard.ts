import { createWalletClient, http, formatEther, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  addresses,
  IdentityRegistryAbi,
  MockUSDCAbi,
  BASE_SEPOLIA_CHAIN_ID,
  CHAIN_ID,
  RPC_URL,
  formatUsdc,
} from "@agentrail/shared";
import { publicClient, type AgentAccount } from "./wallet.js";

/// Bring an agent to the point where it can transact, and stop.
///
/// A smart account starts as an address and nothing else: no code, no gas, no
/// identity. Each of those failures surfaces far from its cause — an unfunded
/// account fails inside the bundler, an unregistered one fails as NotRegistered
/// from createJob — so doing it once, up front, is what makes the rest legible.
///
/// Every step is skipped when already satisfied, so this is safe to run on every
/// start and against a chain that cannot be reset.

/// Enough for a few dozen user operations at Base Sepolia's fees.
const MIN_GAS = parseEther("0.002");
const TOP_UP = parseEther("0.004");
const USDC_GRANT = 1_000_000_000n; // 1000 USDC

/// Send gas to an agent that has none.
///
/// A smart account cannot pay for its own first operation, so something outside
/// it must go first. The treasury is an EOA holding testnet ETH; on a public
/// chain there is no faucet to call and no way around this.
async function fundGas(treasuryKey: Hex, to: `0x${string}`): Promise<void> {
  const treasury = privateKeyToAccount(treasuryKey);
  const balance = await publicClient.getBalance({ address: treasury.address });
  if (balance < TOP_UP) {
    throw new Error(
      `treasury ${treasury.address} holds ${formatEther(balance)} ETH — too little to fund an agent`,
    );
  }

  const wallet = createWalletClient({ account: treasury, chain: baseSepolia, transport: http(RPC_URL) });
  const hash = await wallet.sendTransaction({ to, value: TOP_UP });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`funding ${to} reverted (tx ${hash})`);
}

export interface OnboardOptions {
  /// EOA that pays the first gas. Only needed on a public chain, where an
  /// unfunded account has no other way to get started.
  treasuryKey?: Hex;
  /// Mint MockUSDC too. A provider never spends, so it only needs this if it
  /// will also hire someone.
  grantUsdc?: boolean;
}

export async function onboard(agent: AgentAccount, opts: OnboardOptions = {}): Promise<void> {
  const isTestnet = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID;

  if (isTestnet) {
    const balance = await publicClient.getBalance({ address: agent.address });
    if (balance < MIN_GAS) {
      if (!opts.treasuryKey) {
        throw new Error(
          `${agent.address} has ${formatEther(balance)} ETH and no treasury key was given to top it up`,
        );
      }
      await fundGas(opts.treasuryKey, agent.address);
    }
  }

  const registered = await publicClient.readContract({
    address: addresses.IdentityRegistry,
    abi: IdentityRegistryAbi,
    functionName: "isRegistered",
    args: [agent.address],
  });

  // Registration and the USDC grant batch into one operation where the chain
  // supports it, so a new agent costs a single round trip.
  const calls = [];
  if (!registered) {
    calls.push({
      to: addresses.IdentityRegistry,
      abi: IdentityRegistryAbi as never,
      functionName: "registerAgent",
      args: [agent.address],
    });
  }

  if (opts.grantUsdc) {
    const usdc = (await publicClient.readContract({
      address: addresses.MockUSDC,
      abi: MockUSDCAbi,
      functionName: "balanceOf",
      args: [agent.address],
    })) as bigint;
    if (usdc < USDC_GRANT / 2n) {
      calls.push({
        to: addresses.MockUSDC,
        abi: MockUSDCAbi as never,
        functionName: "mint",
        args: [agent.address, USDC_GRANT],
      });
    }
  }

  if (calls.length > 0) await agent.send(calls);
}

/// One line describing an agent's readiness, for startup logs.
export async function describe(agent: AgentAccount): Promise<string> {
  const [balance, registered, usdc] = await Promise.all([
    publicClient.getBalance({ address: agent.address }),
    publicClient.readContract({
      address: addresses.IdentityRegistry,
      abi: IdentityRegistryAbi,
      functionName: "isRegistered",
      args: [agent.address],
    }),
    publicClient.readContract({
      address: addresses.MockUSDC,
      abi: MockUSDCAbi,
      functionName: "balanceOf",
      args: [agent.address],
    }),
  ]);
  const kind = agent.address === agent.owner ? "EOA" : "smart account";
  return `${agent.address} (${kind}) — ${Number(formatEther(balance)).toFixed(4)} ETH, ${formatUsdc(usdc as bigint)} USDC, registered=${registered}`;
}
