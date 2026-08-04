import {
  CheckCircle2,
  Lock,
  PlusCircle,
  Radio,
  Upload,
} from 'lucide-react'
import { EVENTS, type ActivityEvent, truncateHex } from '@/lib/agentrail-data'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

const EVENT_META: Record<
  ActivityEvent['type'],
  { icon: React.ReactNode; tone: string }
> = {
  JobCreated: {
    icon: <PlusCircle className="size-4" aria-hidden="true" />,
    tone: 'bg-primary/15 text-primary',
  },
  EscrowFunded: {
    icon: <Lock className="size-4" aria-hidden="true" />,
    tone: 'bg-warning/15 text-warning',
  },
  WorkSubmitted: {
    icon: <Upload className="size-4" aria-hidden="true" />,
    tone: 'bg-primary/15 text-primary',
  },
  JobCompleted: {
    icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
    tone: 'bg-success/15 text-success',
  },
}

export function EventFeed() {
  return (
    <section
      aria-labelledby="feed-heading"
      className="flex h-full flex-col rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="feed-heading"
          className="text-base font-semibold text-foreground"
        >
          On-Chain Event Feed
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
          Live
        </span>
      </div>

      <ol className="mt-4 flex flex-col">
        {EVENTS.map((event, index) => {
          const meta = EVENT_META[event.type]
          const isLast = index === EVENTS.length - 1

          return (
            <li key={event.id} className="flex gap-3">
              {/* timeline rail */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    meta.tone,
                  )}
                >
                  {meta.icon}
                </span>
                {!isLast && (
                  <span
                    className="my-1 w-px flex-1 bg-border"
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className={cn('min-w-0 flex-1', !isLast && 'pb-5')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {event.type}
                  </p>
                  <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {event.timeAgo}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {event.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tx
                  </span>
                  <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/50 px-2 py-1 font-mono text-xs text-foreground/80">
                    {truncateHex(event.txHash, 8, 6)}
                  </code>
                  <CopyButton
                    value={event.txHash}
                    label="Copy transaction hash"
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
