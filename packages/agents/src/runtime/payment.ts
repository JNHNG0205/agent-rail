import { decodeEventLog, type Hex } from "viem";
import { addresses, MockUSDCAbi, CHAIN_ID } from "@agentrail/shared";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "../lib/wallet.js";
import { query } from "./db.js";

/// Proving that an agent was paid for.
///
/// The browser makes this payment, because the person signs it from their own
/// wallet. That means the runtime is told "I paid, here is the hash" by the same
/// party that benefits from being believed — so nothing here trusts the claim.
/// The transaction is read from the chain and every part of it checked:
///
///   the receipt succeeded, on this chain
///   it moved MockUSDC, not some other token
///   it went to the treasury, not anywhere else
///   the amount is at least the model's price
///   the payer is an address the caller actually controls
///   the hash has never been used to create an agent before
///
/// The last is the one an attacker reaches for first: without it, one payment
/// creates unlimited agents. It is enforced by a unique index rather than a
/// check-then-insert, because two requests arriving together would both pass the
/// check and both insert.

export interface PaymentClaim {
  txHash: Hex;
  /// The addresses this caller has proved they hold. A payment from anywhere
  /// else is somebody else's, and may well be a transaction they found.
  payerCandidates: string[];
  expectedAmount: bigint;
}

export type PaymentResult =
  | { ok: true; payer: string; amount: bigint }
  | { ok: false; error: string };

export function treasuryAddress(): `0x${string}` | null {
  const key = process.env.BASE_SEPOLIA_TREASURY_PRIVATE_KEY as Hex | undefined;
  if (!key) return null;
  return privateKeyToAccount(key).address;
}

/// Reads the transaction and decides whether it paid for one agent.
///
/// Deliberately does not consume the hash — that happens in `claimPayment`, once
/// the caller is ready to create. Verifying and consuming in one step would burn
/// the payment on a request that then failed validation for an unrelated reason.
export async function verifyPayment(claim: PaymentClaim): Promise<PaymentResult> {
  const treasury = treasuryAddress();
  if (!treasury) {
    return { ok: false, error: "no treasury is configured to receive the fee" };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: claim.txHash });
  } catch {
    // Not yet mined, or not on this chain at all. Both mean "cannot confirm",
    // and the caller should wait rather than be told the payment was bad.
    return { ok: false, error: "that payment is not visible on chain yet" };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "that payment transaction failed on chain" };
  }

  const wanted = new Set(claim.payerCandidates.map((a) => a.toLowerCase()));

  for (const log of receipt.logs) {
    // Only logs from the USDC contract. A different token's Transfer has the
    // same shape and would otherwise decode cleanly.
    if (log.address.toLowerCase() !== addresses.MockUSDC.toLowerCase()) continue;

    let decoded;
    try {
      decoded = decodeEventLog({ abi: MockUSDCAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    if (decoded.eventName !== "Transfer") continue;

    const args = decoded.args as unknown as { from: string; to: string; value: bigint };
    if (args.to.toLowerCase() !== treasury.toLowerCase()) continue;
    if (!wanted.has(args.from.toLowerCase())) continue;
    // At least, not exactly: overpaying is the payer's business, and refusing a
    // transfer that was too large would strand their money for no reason.
    if (args.value < claim.expectedAmount) continue;

    return { ok: true, payer: args.from.toLowerCase(), amount: args.value };
  }

  return {
    ok: false,
    error: "that transaction did not send the fee to the treasury from your wallet",
  };
}

/// Records the hash against the agent about to be created.
///
/// Returns false when the hash is already spent. The unique index does the
/// deciding: a duplicate insert raises rather than returning a row, and two
/// simultaneous requests cannot both win.
export async function claimPayment(opts: {
  txHash: Hex;
  payer: string;
  amount: bigint;
  modelId: string;
  agentId: string;
}): Promise<boolean> {
  try {
    const rows = await query<{ tx_hash: string }>(
      `INSERT INTO $SCHEMA.agent_payment (chain_id, tx_hash, payer, amount, model_id, agent_id)
            VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (chain_id, tx_hash) DO NOTHING
         RETURNING tx_hash`,
      [
        CHAIN_ID,
        opts.txHash.toLowerCase(),
        opts.payer.toLowerCase(),
        opts.amount.toString(),
        opts.modelId,
        opts.agentId,
      ],
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[payment] could not record the fee", err);
    return false;
  }
}

/// Undo a claim, for when creation fails after the payment was consumed. The
/// person keeps their receipt and can try again with the same transaction rather
/// than paying twice for an agent that never existed.
export async function releasePayment(txHash: Hex): Promise<void> {
  await query(`DELETE FROM $SCHEMA.agent_payment WHERE chain_id = $1 AND tx_hash = $2`, [
    CHAIN_ID,
    txHash.toLowerCase(),
  ]);
}
