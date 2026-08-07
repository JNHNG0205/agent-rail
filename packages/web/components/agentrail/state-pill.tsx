import { statusOf, type JobOutcome } from "@/lib/status";
import { cn } from "@/lib/utils";

/// The one way a job's state is shown. Member 4.
///
/// A component rather than a class each caller applies, so that every list, card
/// and drawer draws the same conclusion from the same two fields. The hue comes
/// from data-state in the stylesheet, which means a status cannot be tinted by
/// hand into looking like something it is not.
///
/// The dot is not ornament: it carries the hue at a size that survives being
/// scanned down a column, and it keeps the pill legible to anyone reading shape
/// rather than colour.

export function StatePill({
  state,
  outcome,
  className,
  withMeaning = false,
}: {
  state: number;
  outcome: JobOutcome;
  className?: string;
  /// Spell the consequence out. Worth it where one job is the subject of the
  /// screen; too much noise in a list of forty.
  withMeaning?: boolean;
}) {
  const status = statusOf(state, outcome);
  return (
    <span
      className={cn("state-pill", className)}
      data-state={status.key}
      title={status.meaning}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      />
      {status.label}
      {withMeaning && (
        <span className="font-normal opacity-70">· {status.meaning}</span>
      )}
    </span>
  );
}
