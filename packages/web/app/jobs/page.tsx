import Link from "next/link";
import { JobStateBadge } from "@/components/JobStateBadge";
import { JobState, type Job } from "@agentrail/shared";

/// Job list + current states. Server component fetching from the jobs API. Member 3.
async function getJobs(): Promise<Job[]> {
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
              <JobStateBadge state={job.state ?? JobState.Open} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
