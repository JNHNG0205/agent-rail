import { createWalletClient, http, formatEther, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { RPC_URL } from "@agentrail/shared";
import { publicClient } from "../lib/wallet.js";

/// Give a person's own wallet enough gas to send one transaction.
///
/// Depositing means signing an ERC-20 transfer from their wallet, and a wallet
/// with no ETH cannot sign anything. Agents never hit this — the treasury funds
/// them at onboarding and they pay their own way afterwards — but a person who
/// signed in with an email has an embedded wallet that has never held anything.
///
/// This is a testnet faucet and nothing more. There is no equivalent on a real
/// network, where the person would already hold ETH or the app would sponsor
/// gas through a paymaster. Saying so plainly matters: the demo works because
/// the platform pays, not because the problem is solved.
///
/// Deliberately small and conditional. It sends only when the wallet is below
/// what one transfer costs, and only enough for a few — a treasury that will
/// hand out ETH on request is a treasury that gets drained on request.

/// Roughly a few ERC-20 transfers at Base Sepolia's fees.
const ENOUGH = parseEther("0.0004");
const TOP_UP = parseEther("0.0008");

export interface GasResult {
  /// Null when the wallet already had enough — the caller should treat that as
  /// success, not as a failure to send.
  txHash: Hex | null;
  balance: bigint;
}

export async function fundWalletGas(treasuryKey: Hex, to: `0x${string}`): Promise<GasResult> {
  const existing = await publicClient.getBalance({ address: to });
  if (existing >= ENOUGH) return { txHash: null, balance: existing };

  const treasury = privateKeyToAccount(treasuryKey);
  const treasuryBalance = await publicClient.getBalance({ address: treasury.address });
  if (treasuryBalance < TOP_UP) {
    throw new Error(
      `treasury ${treasury.address} holds ${formatEther(treasuryBalance)} ETH — too little to fund a wallet`,
    );
  }

  const wallet = createWalletClient({
    account: treasury,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });
  const txHash = await wallet.sendTransaction({ to, value: TOP_UP });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`funding ${to} reverted (tx ${txHash})`);

  console.log(`[runtime] sent ${formatEther(TOP_UP)} ETH of gas to ${to}`);
  return { txHash, balance: await visibleBalance(to) };
}

/// Read the balance once the endpoint agrees it changed.
///
/// A receipt proves the transfer happened; it does not promise the next request
/// sees it. The endpoint is a pool, and reading straight after a receipt
/// returned zero for a wallet that had just been funded — which would tell a
/// caller the faucet failed when it had not, and send them to sign a
/// transaction they were told they could not afford.
async function visibleBalance(address: `0x${string}`): Promise<bigint> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const balance = await publicClient.getBalance({ address });
    if (balance > 0n) return balance;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return publicClient.getBalance({ address });
}
