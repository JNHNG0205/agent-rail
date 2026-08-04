/// Identity, reputation, and balance for one agent. Presentational (no hooks)
/// so it works in server components; pass data in. Member 3.
export function AgentCard({
  address,
  label,
  reputation,
}: {
  address: `0x${string}`;
  label?: string;
  reputation?: number;
}) {
  return (
    <div style={{ border: "1px solid #1c2230", borderRadius: 8, padding: "1rem" }}>
      <div style={{ fontWeight: 600 }}>{label ?? "Agent"}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem", wordBreak: "break-all" }}>{address}</div>
      <div style={{ marginTop: "0.5rem" }}>
        Reputation: <strong>{reputation ?? 0}</strong>
      </div>
      {/* TODO(M3): show USDC balance read via lib/contracts. */}
    </div>
  );
}
