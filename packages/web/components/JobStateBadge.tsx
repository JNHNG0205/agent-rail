import { JobState, JOB_STATE_LABELS } from "@agentrail/shared";

const COLORS: Record<JobState, string> = {
  [JobState.Open]: "#8a91a0",
  [JobState.Funded]: "#5b8cff",
  [JobState.Submitted]: "#e0a539",
  [JobState.Terminal]: "#3ecf8e",
};

/// Open / Funded / Submitted / Terminal badge. Member 3.
export function JobStateBadge({ state }: { state: JobState }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1rem 0.5rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        background: `${COLORS[state]}22`,
        color: COLORS[state],
      }}
    >
      {JOB_STATE_LABELS[state]}
    </span>
  );
}
