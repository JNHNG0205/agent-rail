import { AgentCard } from "@/components/AgentCard";

/// Agent profile + reputation. Member 3.
export default function AgentProfilePage({ params }: { params: { address: string } }) {
  const address = params.address as `0x${string}`;

  return (
    <div>
      <h1>Agent</h1>
      <AgentCard address={address} />
      {/* TODO(M3): list this agent's jobs + reputation history from /api. */}
    </div>
  );
}
