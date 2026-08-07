'use client'

import { useState } from 'react'
import { ChevronDown, FileSignature, Fingerprint, Lock } from 'lucide-react'
import { type JobStep, formatUsdc } from '@/lib/agentrail-data'
import { agentLabel } from '@agentrail/shared'
import { useJobs } from '@/hooks/useJobs'
import { JOB_STATE_LABELS } from '@agentrail/shared'
import { StatePill } from '@/components/agentrail/state-pill'
import { ProgressTracker } from './progress-tracker'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

function DetailRow({
  icon,
  label,
  mono,
  children,
  copyValue,
}: {
  icon: React.ReactNode
  label: string
  mono?: boolean
  children: React.ReactNode
  copyValue?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              'truncate text-sm text-foreground',
              mono && 'font-mono',
            )}
          >
            {children}
          </div>
        </div>
      </div>
      {copyValue ? <CopyButton value={copyValue} label={`Copy ${label}`} /> : null}
    </div>
  )
}

export function JobEscrowManager() {
  const { jobs: liveJobs } = useJobs()

  const liveJob = liveJobs[0]
  const currentStepLabel = liveJob ? (JOB_STATE_LABELS[liveJob.state] as JobStep) : null

  const job = liveJob
    ? {
        id: String(liveJob.id),
        jobId: String(liveJob.id),
        buyer: agentLabel(liveJob.client),
        worker: agentLabel(liveJob.provider),
        createdAt: `block ${liveJob.createdBlock}`,
        currentStep: currentStepLabel,
        escrowAmount: liveJob.amount,
        deliverableHash: liveJob.deliverableHash ?? null,
      }
    : null

  if (!job || !currentStepLabel) {
    return (
      <section className="rounded-2xl border border-white/10 bg-card/60 p-10 text-center backdrop-blur-md">
        <p className="text-sm font-semibold text-foreground">No jobs yet</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Commission one from the Assistant tab and it will appear here.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="escrow-heading"
      className="flex h-[440px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-card/90 via-card/75 to-card/50 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/30"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <h2
            id="escrow-heading"
            className="text-base font-bold tracking-tight text-foreground"
          >
            The money for this job
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {job.buyer} → {job.worker} · opened {job.createdAt}
          </p>
        </div>
        <StatePill state={liveJob.state} outcome={liveJob.outcome ?? null} />
      </div>

      {/* Progress tracker */}
      <div className="my-auto rounded-xl border border-white/5 bg-secondary/30 p-4 md:p-5 shadow-inner">
        <ProgressTracker currentStep={currentStepLabel} />
      </div>

      {/* Job details */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetailRow
          icon={<Fingerprint className="size-4 text-primary" aria-hidden="true" />}
          label="Job ID"
          mono
          copyValue={job.jobId}
        >
          #{job.jobId}
        </DetailRow>

        <DetailRow
          icon={<Lock className="size-4 text-amber-400" aria-hidden="true" />}
          label="Escrow Amount"
        >
          <span className="font-mono font-bold text-foreground">
            {formatUsdc(job.escrowAmount)} USDC
          </span>
        </DetailRow>

        <DetailRow
          icon={<FileSignature className="size-4 text-primary" aria-hidden="true" />}
          label="Approval Status"
        >
          <span className={cn('font-medium', liveJob?.state === 3 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground')}>
            {liveJob?.state === 3 ? '✓ Evaluated & Settled' : 'Awaiting evaluation'}
          </span>
        </DetailRow>
      </div>
    </section>
  )
}
