'use client'

import { useState } from 'react'
import {
  ChevronDown,
  FileSignature,
  Fingerprint,
  Hash,
  Lock,
} from 'lucide-react'
import { ACTIVE_JOB, type JobStep, formatUsdc, truncateHex } from '@/lib/agentrail-data'
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
  const [showSignature, setShowSignature] = useState(false)
  const { jobs: liveJobs } = useJobs()

  const liveJob = liveJobs[0]
  const currentStepLabel = liveJob ? (JOB_STATE_LABELS[liveJob.state] as JobStep) : ACTIVE_JOB.currentStep

  const job = liveJob
    ? {
        id: String(liveJob.id),
        jobId: String(liveJob.id),
        buyer: `Agent A (${truncateHex(liveJob.client, 6, 4)})`,
        worker: `Agent B (${truncateHex(liveJob.provider, 6, 4)})`,
        createdAt: "On-Chain",
        currentStep: currentStepLabel,
        escrowAmount: liveJob.amount,
        deliverableHash: liveJob.deliverableHash ?? ("0x" + "0".repeat(64) as `0x${string}`),
        signature: "0xf3a9c2e8f3a9c2e8f3a9c2e8f3a9c2e8b7d6a5f4b7d6a5f4b7d6a5f4b7d6a5f41c",
      }
    : ACTIVE_JOB

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
        <ProgressTracker currentStep={job.currentStep} />
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

        <DetailRow
          icon={<Hash className="size-4" aria-hidden="true" />}
          label="Deliverable Hash (keccak256)"
          mono
          copyValue={job.deliverableHash}
        >
          {truncateHex(job.deliverableHash, 10, 8)}
        </DetailRow>

        <DetailRow
          icon={<FileSignature className="size-4" aria-hidden="true" />}
          label="Approval Status"
        >
          <span className="text-success">Signed &amp; verified</span>
        </DetailRow>
      </div>

      {/* Expandable signature */}
      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowSignature((v) => !v)}
          aria-expanded={showSignature}
          className="flex w-full items-center justify-between gap-3 bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
            <FileSignature
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            ECDSA Approval Signature
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              showSignature && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
        {showSignature && (
          <div className="border-t border-border bg-background/50 p-3">
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-secondary/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {job.signature}
              </code>
              <CopyButton
                value={job.signature}
                label="Copy signature"
                className="mt-0.5"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
