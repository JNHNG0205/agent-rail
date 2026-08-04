'use client'

import { useEffect, useState } from 'react'
import { X, Lock, Hash, Coins, Loader2 } from 'lucide-react'
import { REGISTERED_AGENTS, pseudoKeccak, truncateHex } from '@/lib/agentrail-data'
import { useJobActions } from '@/hooks/useJobActions'
import { addresses } from '@agentrail/shared'
import { cn } from '@/lib/utils'

export function CreateJobModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const workers = REGISTERED_AGENTS.filter((a) => a.role !== 'Evaluator')
  const [worker, setWorker] = useState<string>(String(workers[0]?.tokenId ?? ''))
  const [amount, setAmount] = useState('10')
  const [spec, setSpec] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { createJob, pending, error } = useJobActions()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const deliverableHash = pseudoKeccak(spec || 'pending-deliverable')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    try {
      const clientAccount = REGISTERED_AGENTS[0].address
      const providerAccount = REGISTERED_AGENTS[1].address
      const evaluatorAccount = REGISTERED_AGENTS[2].address

      const amountUsdcMinor = BigInt(Math.floor(parseFloat(amount || "10") * 1_000_000))

      await createJob(clientAccount, providerAccount, evaluatorAccount, amountUsdcMinor)
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 1000)
    } catch (err) {
      console.error("[CreateJobModal] Error creating job:", err)
      setSubmitted(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-job-title"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="create-job-title"
              className="text-base font-semibold text-foreground"
            >
              Create Escrow Job
            </h2>
            <p className="text-sm text-muted-foreground">
              Deploy an ERC-8183 escrow and lock USDC on-chain.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="worker"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Assign Worker Agent
            </label>
            <select
              id="worker"
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {workers.map((a) => (
                <option key={a.tokenId} value={a.tokenId}>
                  {a.name} · #{a.tokenId}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="amount"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Escrow Amount (USDC)
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary/40 px-3 focus-within:ring-2 focus-within:ring-ring">
              <Coins className="size-4 text-warning" aria-hidden="true" />
              <input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent py-2.5 font-mono text-sm text-foreground outline-none"
              />
              <span className="text-xs text-muted-foreground">USDC</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="spec"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Deliverable Spec
            </label>
            <textarea
              id="spec"
              rows={3}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="Describe the expected deliverable…"
              className="w-full resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
            <Hash className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Computed keccak256 Hash
              </p>
              <code className="block truncate font-mono text-sm text-foreground">
                {truncateHex(deliverableHash, 12, 10)}
              </code>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending || submitted}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              submitted
                ? 'bg-success text-success-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" aria-hidden="true" />
            )}
            {submitted ? 'Escrow Locked' : pending ? 'Creating Job...' : 'Deploy & Lock Escrow'}
          </button>
        </form>
      </div>
    </div>
  )
}
