import Link from "next/link";
import { JobStateBadge } from "@/components/JobStateBadge";
import { JOB_STATE_BY_LABEL, JobState, type JobRow } from "@agentrail/shared";

/// Job list + current states. Server component fetching from the jobs API. Member 3.
/// JobRow, not Job — /api/jobs returns strings for amount and createdBlock and
/// a label for state, because JSON cannot carry a bigint. Use toJob() if you
/// need arithmetic; formatUsdc(BigInt(row.amount)) is enough to display one.
async function getJobs(): Promise<JobRow[]> {
  // TODO(M3): fetch(`${baseUrl}/api/jobs`) against the indexed DB.
  return [];
}

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div>
      <h1>Jobs</h1>
      {jobs.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No jobs yet. Run the agents to create one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {jobs.map((job) => (
            <li key={job.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #1c2230" }}>
              <Link href={`/jobs/${job.id}`}>Job #{job.id}</Link>{" "}
              <JobStateBadge state={JOB_STATE_BY_LABEL[job.state] ?? JobState.Open} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
