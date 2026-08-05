import type { Abi, Hex } from "viem";
import { addresses, MockUSDCAbi, formatUsdc } from "@agentrail/shared";
import { publicClient } from "../lib/wallet.js";
import { accountOf, getAgent, isReady } from "./store.js";

/// Take an agent's earnings out to a person's own wallet.
///
/// This is the only path by which value leaves the system, and it cannot be
/// undone — so everything it depends on is checked here rather than assumed
/// from the caller.
///
/// It does NOT decide who may withdraw or where to. Ownership is settled at the
/// HTTP boundary, and the destination must be a wallet Privy has signed for; an
/// address chosen by the caller is whatever the page sent. This function is
/// given a destination that has already been proved.

export interface WithdrawResult {
  txHash: Hex;
  amount: bigint;
  to: `0x${string}`;
  remaining: bigint;
}

export async function withdraw(opts: {
  agentId: string;
  to: `0x${string}`;
  amount: bigint;
}): Promise<WithdrawResult> {
  if (opts.amount <= 0n) throw new Error("amount must be greater than zero");

  const record = await getAgent(opts.agentId);
  if (!record) throw new Error(`no agent "${opts.agentId}"`);
  if (!isReady(record)) {
    // An agent that never finished onboarding holds no gas, so the transfer
    // would fail after the caller had been told it was under way.
    throw new Error(`"${record.name}" has not finished onboarding`);
  }

  const balance = (await publicClient.readContract({
    address: addresses.MockUSDC,
    abi: MockUSDCAbi,
    functionName: "balanceOf",
    args: [record.address],
  })) as bigint;

  // Checked before sending, though the token would revert anyway: a revert
  // costs gas and reports "execution reverted", which tells nobody that the
  // real answer is "you asked for more than it holds".
  if (opts.amount > balance) {
    throw new Error(
      `"${record.name}" holds ${formatUsdc(balance)} USDC — cannot withdraw ${formatUsdc(opts.amount)}`,
    );
  }

  const account = await accountOf(record);
  const txHash = await account.send([
    {
      to: addresses.MockUSDC,
      abi: MockUSDCAbi as Abi,
      functionName: "transfer",
      args: [opts.to, opts.amount],
    },
  ]);

  console.log(
    `[runtime] ${record.name}: withdrew ${formatUsdc(opts.amount)} USDC to ${opts.to}`,
  );

  return { txHash, amount: opts.amount, to: opts.to, remaining: balance - opts.amount };
}

/// What an agent holds, so a person can see what there is to take.
export async function balanceOf(agentId: string): Promise<bigint> {
  const record = await getAgent(agentId);
  if (!record) throw new Error(`no agent "${agentId}"`);
  return (await publicClient.readContract({
    address: addresses.MockUSDC,
    abi: MockUSDCAbi,
    functionName: "balanceOf",
    args: [record.address],
  })) as bigint;
}
