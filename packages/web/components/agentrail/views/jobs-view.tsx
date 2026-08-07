'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Download,
  ExternalLink,
  Fingerprint,
  Hash,
  Layers3,
  Lock,
  X,
} from 'lucide-react'
import {
  JOB_STEPS,
  type JobStep,
  formatUsdc,
  truncateHex,
} from '@/lib/agentrail-data'
import { useJobs } from '@/hooks/useJobs'
import { useJobResult } from '@/hooks/useJobResult'
import { useRegistry } from '@/hooks/useRegistry'
import { JOB_STATE_LABELS, agentLabel } from '@agentrail/shared'
import { ProgressTracker } from '@/components/agentrail/progress-tracker'
import { CopyButton } from '@/components/agentrail/copy-button'
import { StatePill } from '@/components/agentrail/state-pill'
import { statusOf, STATUS_KEYS, statusByKey, type JobOutcome, type StatusKey } from '@/lib/status'
import { cn } from '@/lib/utils'

const FILTERS: (StatusKey | 'All')[] = ['All', ...STATUS_KEYS]

/// What this view shows for one job. Every field is derived from the indexed row
/// — the labels come from agentLabel(), the blocks from the chain. Nothing here
/// is invented for display.
interface JobRow {
  id: string
  title: string
  buyer: string
  worker: string
  client: `0x${string}`
  provider: `0x${string}`
  evaluator: `0x${string}`
  amount: bigint
  escrowAmount: bigint
  status: JobStep
  /// Kept alongside the label because `Terminal` alone cannot say whether the
  /// money was paid, returned, or taken after nobody judged the work.
  state: number
  outcome: JobOutcome
  step: 1 | 2 | 3 | 4
  currentStep: JobStep
  deliverableHash: `0x${string}` | null
  block: string
  createdAt: string
  updatedAt: string
}

function JobDrawer({ job, onClose }: { job: JobRow; onClose: () => void }) {
  // Live, from the chain. The row behind this drawer comes from the indexer,
  // which is right for a list of history and wrong the moment someone opens a
  // job that is still moving: a job settled minutes ago still read "Submitted"
  // here while its escrow had already been released. The list can lag; the
  // thing someone opened to watch cannot.
  const live = useJobResult(job.id)
  const status = live.stage ?? job.status
  // The pill needs both halves, and each has its own freshest source: the chain
  // knows the stage first, and only the indexer's events can say which of the
  // three endings a Terminal job reached.
  const state = JOB_STEPS.indexOf(status)
  const outcome = live.outcome ?? job.outcome

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-drawer-title"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Escrow Job
            </p>
            <h2
              id="job-drawer-title"
              className="font-mono text-sm font-semibold text-foreground"
            >
              {job.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job details"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <StatePill state={state} outcome={outcome} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 font-mono text-xs font-medium text-foreground">
              <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {formatUsdc(job.amount)} USDC
            </span>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-4">
            <ProgressTracker currentStep={status} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Buyer
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {job.buyer}
              </p>
            </div>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Worker
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {job.worker}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <Fingerprint
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Job ID
                </p>
                <code className="block truncate font-mono text-sm text-foreground">
                  {job.id}
                </code>
              </div>
              <CopyButton value={job.id} label="Copy job id" />
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <Hash
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Deliverable Hash (keccak256)
                </p>
                <code className="block truncate font-mono text-sm text-foreground">
                  {job.deliverableHash
                    ? truncateHex(job.deliverableHash, 12, 10)
                    : 'not submitted yet'}
                </code>
              </div>
              {job.deliverableHash && (
                <CopyButton value={job.deliverableHash} label="Copy deliverable hash" />
              )}
            </div>

            {/* The work itself, not just its fingerprint. The hash proves the
                bytes were not swapped; it does not let anyone read them, and a
                settled job whose output nobody can see is a receipt without a
                purchase. The route re-derives the hash before serving. */}
            {live.deliverableUrl && (
              <div className="rounded-lg border border-border bg-secondary/40">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Delivered work
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/deliverable/${job.id}?download=1`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <Download className="size-3" aria-hidden="true" /> Download
                    </a>
                    <a
                      href={`/api/deliverable/${job.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      Open <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
                {/* Sandboxed: untrusted output from another agent, served under
                    a locked-down CSP by the route. */}
                <iframe
                  src={`/api/deliverable/${job.id}`}
                  title={`Deliverable for job ${job.id}`}
                  sandbox=""
                  // The page declares color-scheme: dark, and an iframe
                  // inherits it — so a plain-text deliverable was rendered with
                  // dark-mode defaults, white on the white background set here,
                  // and could only be read by selecting it. The document inside
                  // is the provider's own bytes and is not ours to restyle, so
                  // the frame declares light instead.
                  style={{ colorScheme: "light" }}
                  className="h-64 w-full rounded-b-lg border-t border-border bg-white"
                />
              </div>
            )}

            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <Layers3
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Created / Block
                </p>
                <p className="text-sm text-foreground">
                  {job.createdAt} ·{' '}
                  <span className="font-mono">#{job.block.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function JobsView() {
  const [filter, setFilter] = useState<StatusKey | 'All'>('All')
  const [selected, setSelected] = useState<JobRow | null>(null)
  const { jobs: liveJobs } = useJobs()
  // agentLabel only knows the seeded three; every agent a user created is just
  // an address to it. The registry has the names people actually chose.
  const { agents } = useRegistry()
  const nameOf = useMemo(() => {
    const byAddress = new Map(agents.map((a) => [a.address.toLowerCase(), a.name]))
    return (address: string) => byAddress.get(address.toLowerCase()) ?? agentLabel(address as `0x${string}`)
  }, [agents])

  const allJobsList: JobRow[] = liveJobs.length > 0
    ? liveJobs.map((j) => {
        const stateLabel = JOB_STATE_LABELS[j.state] as JobStep
        return {
          id: String(j.id),
          jobId: String(j.id),
          title: `Job #${j.id}`,
          client: j.client,
          provider: j.provider,
          evaluator: j.evaluator,
          buyer: nameOf(j.client),
          worker: nameOf(j.provider),
          amount: j.amount,
          escrowAmount: j.amount,
          status: stateLabel,
          state: j.state,
          outcome: j.outcome,
          step: (j.state + 1) as 1 | 2 | 3 | 4,
          currentStep: stateLabel,
          deliverableHash: j.deliverableHash ?? null,
          block: String(j.createdBlock),
          createdAt: `block ${j.createdBlock}`,
          updatedAt: `block ${j.updatedBlock ?? j.createdBlock}`,
        }
      })
    : []

  const filtered = useMemo(
    () =>
      filter === 'All'
        ? allJobsList
        : allJobsList.filter((j) => statusOf(j.state, j.outcome).key === filter),
    [filter, allJobsList],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Escrow Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          ERC-8183 job state machine across all historical and active escrows.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f === filter
          const count =
            f === 'All'
              ? allJobsList.length
              : allJobsList.filter((j) => statusOf(j.state, j.outcome).key === f).length
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'All' ? 'All' : statusByKey(f).label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px]',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table (desktop) */}
      <div className="hidden overflow-hidden sheet rounded-2xl md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Job ID</th>
              <th className="px-4 py-3 font-medium">Parties</th>
              <th className="px-4 py-3 font-medium">Amount (USDC)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr
                key={job.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/30"
              >
                <td className="px-4 py-3">
                  <code className="font-mono text-foreground">{job.id}</code>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.buyer} <ArrowRight className="inline size-3" aria-hidden="true" />{' '}
                  {job.worker}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {formatUsdc(job.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatePill state={job.state} outcome={job.outcome} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.createdAt}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(job)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Details
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filtered.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => setSelected(job)}
            className="sheet p-4 text-left transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-sm text-foreground">{job.id}</code>
              <StatePill state={job.state} outcome={job.outcome} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {job.buyer} <ArrowRight className="inline size-3" aria-hidden="true" />{' '}
              {job.worker}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatUsdc(job.amount)} USDC
              </span>
              <span className="text-xs text-muted-foreground">
                {job.createdAt}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <JobDrawer job={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
