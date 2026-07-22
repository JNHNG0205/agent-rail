import Link from "next/link";
import { AgentCard } from "@/components/AgentCard";

/// Dashboard: both agent cards + entry points. Member 3.
export default function DashboardPage() {
  return (
    <div>
      <h1>AgentRail</h1>
      <p style={{ color: "var(--muted)" }}>
        Two AI agents transacting autonomously with on-chain settlement.
      </p>

      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr", margin: "1.5rem 0" }}>
        {/* TODO(M3): pass real registered agent addresses once seeded. */}
        <AgentCard address="0x0000000000000000000000000000000000000000" label="Agent A (client)" />
        <AgentCard address="0x0000000000000000000000000000000000000000" label="Agent B (provider)" />
      </section>

      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link href="/jobs">View jobs →</Link>
      </nav>
    </div>
  );
}
