'use client'

import { useState } from 'react'
import { ChevronDown, FileSignature, Fingerprint, Lock } from 'lucide-react'
import { type JobStep, formatUsdc } from '@/lib/agentrail-data'
import { agentLabel } from '@agentrail/shared'
import { useJobs } from '@/hooks/useJobs'
import { JOB_STATE_LABELS } from '@agentrail/shared'
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
      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">No jobs yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Commission one from the Assistant tab and it will appear here.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="escrow-heading"
      className="rounded-2xl border border-border bg-card p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="escrow-heading"
            className="text-base font-semibold text-foreground"
          >
            ERC-8183 Job Escrow Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            {job.buyer} → {job.worker} · opened {job.createdAt}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          <Lock className="size-3.5" aria-hidden="true" />
          Escrow Locked
        </span>
      </div>

      {/* Progress tracker */}
      <div className="mt-6 rounded-xl border border-border bg-background/40 p-4 md:p-5">
        <ProgressTracker currentStep={currentStepLabel} />
      </div>

      {/* Job details */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetailRow
          icon={<Fingerprint className="size-4" aria-hidden="true" />}
          label="Job ID"
          mono
          copyValue={job.jobId}
        >
          {job.jobId}
        </DetailRow>

        <DetailRow
          icon={<Lock className="size-4" aria-hidden="true" />}
          label="Escrow Amount"
        >
          <span className="font-mono font-semibold">
            {formatUsdc(job.escrowAmount)}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              USDC
            </span>
          </span>
        </DetailRow>

        {/* The keccak hash lives on the Escrow Jobs and Evaluator tabs, where
            proving what was graded is the subject. Here it was a third copy on
            the page someone opens to see how their own agents are doing. */}

        <DetailRow
          icon={<FileSignature className="size-4" aria-hidden="true" />}
          label="Approval Status"
        >
          <span className={liveJob?.state === 3 ? 'text-success' : 'text-muted-foreground'}>
            {liveJob?.state === 3 ? 'Evaluated' : 'Awaiting evaluation'}
          </span>
        </DetailRow>
      </div>
    </section>
  )
}
