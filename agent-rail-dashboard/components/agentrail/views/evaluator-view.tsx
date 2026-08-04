'use client'

import { useMemo, useState } from 'react'
import {
  Hash,
  FileSignature,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Cpu,
} from 'lucide-react'
import {
  REGISTERED_AGENTS,
  pseudoKeccak,
  truncateHex,
} from '@/lib/agentrail-data'
import { CopyButton } from '@/components/agentrail/copy-button'
import { cn } from '@/lib/utils'

// r (32 bytes) + s (32 bytes) + v (1 byte) = 65 bytes = 130 hex chars
const VALID_SIG =
  '0x' + 'f3a9c2e8'.repeat(8) + 'b7d6a5f4'.repeat(8) + '1c'

type RecoveryState = 'idle' | 'valid' | 'invalid'

export function EvaluatorView() {
  const [deliverable, setDeliverable] = useState(
    'ipfs://bafybeigdyrztresult-payload-v3',
  )
  const [signature, setSignature] = useState('')
  const [state, setState] = useState<RecoveryState>('idle')
  const [recovered, setRecovered] = useState<string | null>(null)

  const evaluator = REGISTERED_AGENTS.find((a) => a.role === 'Evaluator')
  const deliverableHash = useMemo(
    () => pseudoKeccak(deliverable || 'empty'),
    [deliverable],
  )

  function isHexSig(v: string) {
    return /^0x[0-9a-fA-F]{130}$/.test(v.trim())
  }

  function handleVerify() {
    const sig = signature.trim()
    if (!isHexSig(sig)) {
      setState('invalid')
      setRecovered(null)
      return
    }
    if (sig.toLowerCase() === VALID_SIG.toLowerCase()) {
      setState('valid')
      setRecovered(evaluator?.address ?? null)
    } else {
      // deterministic pseudo-recovered address for any well-formed but unknown sig
      setState('invalid')
      setRecovered('0x' + pseudoKeccak(sig).slice(2, 42))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Evaluator Suite
        </h1>
        <p className="text-sm text-muted-foreground">
          ERC-7579 playground — hash deliverables and verify ECDSA approval
          signatures via <span className="font-mono">ECDSA.recover</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Hash panel */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <Hash className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                keccak256 Deliverable Hash
              </h2>
              <p className="text-xs text-muted-foreground">
                Hash the raw deliverable payload.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="deliverable"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Deliverable Payload
            </label>
            <textarea
              id="deliverable"
              rows={3}
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              className="w-full resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-foreground">
              {deliverableHash}
            </code>
            <CopyButton value={deliverableHash} label="Copy hash" />
          </div>
        </section>

        {/* Signature panel */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <FileSignature className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                ECDSA Signature Recovery
              </h2>
              <p className="text-xs text-muted-foreground">
                Paste an approval signature to recover the signer.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="signature"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Approval Signature (65 bytes)
              </label>
              <button
                type="button"
                onClick={() => setSignature(VALID_SIG)}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Use sample
              </button>
            </div>
            <textarea
              id="signature"
              rows={3}
              value={signature}
              onChange={(e) => {
                setSignature(e.target.value)
                setState('idle')
              }}
              placeholder="0x…"
              className="w-full resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <button
            type="button"
            onClick={handleVerify}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <Cpu className="size-4" aria-hidden="true" />
            Run ECDSA.recover
          </button>

          {/* Result */}
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3',
              state === 'valid' &&
                'border-success/30 bg-success/10 text-success',
              state === 'invalid' &&
                'border-destructive/30 bg-destructive/10 text-destructive',
              state === 'idle' &&
                'border-border bg-secondary/40 text-muted-foreground',
            )}
          >
            {state === 'valid' ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : state === 'invalid' ? (
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldQuestion
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {state === 'valid'
                  ? 'Signature verified'
                  : state === 'invalid'
                    ? 'Verification failed'
                    : 'Awaiting verification'}
              </p>
              {state === 'idle' ? (
                <p className="text-xs text-muted-foreground">
                  Signer will be recovered and matched against the registry.
                </p>
              ) : recovered ? (
                <p className="mt-0.5 font-mono text-xs">
                  Recovered signer: {truncateHex(recovered, 10, 8)}
                  {state === 'valid' && evaluator ? (
                    <span className="ml-1 font-sans text-success/80">
                      ({evaluator.name})
                    </span>
                  ) : (
                    <span className="ml-1 font-sans">
                      (not an authorized evaluator)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs">
                  Malformed signature — expected a 65-byte hex string.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
