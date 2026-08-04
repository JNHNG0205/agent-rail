"use client";

import { useState } from "react";

/// Demo form to create a job from the UI (optional — the agents normally do
/// this autonomously). Member 3.
export function CreateJobForm() {
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO(M3): use a wallet client to call jobContract.createJob(provider, amount).
    console.log("create job", { provider, amount });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
      <input
        placeholder="Provider address (0x…)"
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
      />
      <input
        placeholder="Amount (USDC)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit">Create job</button>
    </form>
  );
}
