import { TxFeed } from "@/components/TxFeed";

/// Job detail + event timeline. Member 3.
export default function JobDetailPage({ params }: { params: { id: string } }) {
  const jobId = Number(params.id);

  return (
    <div>
      <h1>Job #{jobId}</h1>
      {/* TODO(M3): fetch job detail (client, provider, amount, state, hash)
          from /api/jobs and render the on-chain timeline below. */}
      <p style={{ color: "var(--muted)" }}>Job detail placeholder.</p>
      <h2>Timeline</h2>
      <TxFeed jobId={jobId} />
    </div>
  );
}
