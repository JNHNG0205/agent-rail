"use client";

import { useState } from "react";
import { publicClient, getWalletClient } from "@/lib/viem";
import { jobContract, mockUsdc } from "@/lib/contracts";

/// Custom hook to execute JobContract actions (createJob, fundJob) via viem wallet client. Member 3.
export function useJobActions() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createJob = async (
    account: `0x${string}`,
    provider: `0x${string}`,
    evaluator: `0x${string}`,
    amountUsdcMinor: bigint
  ) => {
    setPending(true);
    setError(null);
    try {
      const walletClient = getWalletClient(account);

      const hash = await walletClient.writeContract({
        address: jobContract.address,
        abi: jobContract.abi,
        account,
        functionName: "createJob",
        args: [provider, evaluator, amountUsdcMinor],
      } as never);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setPending(false);
    }
  };

  const fundJob = async (
    account: `0x${string}`,
    jobId: bigint,
    amountUsdcMinor: bigint
  ) => {
    setPending(true);
    setError(null);
    try {
      const walletClient = getWalletClient(account);

      // Approve MockUSDC spending first
      const approveHash = await walletClient.writeContract({
        address: mockUsdc.address,
        abi: mockUsdc.abi,
        account,
        functionName: "approve",
        args: [jobContract.address, amountUsdcMinor],
      } as never);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Fund the job on JobContract
      const hash = await walletClient.writeContract({
        address: jobContract.address,
        abi: jobContract.abi,
        account,
        functionName: "fundJob",
        args: [jobId],
      } as never);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setPending(false);
    }
  };

  return { createJob, fundJob, pending, error };
}
