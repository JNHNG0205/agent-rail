"use client";

import {
  CheckCircle2,
  Lock,
  PlusCircle,
  Radio,
  Upload,
} from 'lucide-react'
import { truncateHex } from '@/lib/agentrail-data'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

const EVENT_META: Record<
  string,
  { icon: React.ReactNode; tone: string }
> = {
  JobCreated: {
    icon: <PlusCircle className="size-4" aria-hidden="true" />,
    tone: 'border-primary/30 bg-primary/10 text-primary shadow-sm',
  },
  JobFunded: {
    icon: <Lock className="size-4" aria-hidden="true" />,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm',
  },
  EscrowFunded: {
    icon: <Lock className="size-4" aria-hidden="true" />,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm',
  },
  DeliverableSubmitted: {
    icon: <Upload className="size-4" aria-hidden="true" />,
    tone: 'border-primary/30 bg-primary/10 text-primary shadow-sm',
  },
  WorkSubmitted: {
    icon: <Upload className="size-4" aria-hidden="true" />,
    tone: 'border-primary/30 bg-primary/10 text-primary shadow-sm',
  },
  JobCompleted: {
    icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm',
  },
  JobCancelled: {
    icon: <Radio className="size-4" aria-hidden="true" />,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-sm',
  },
}

export function EventFeed() {
  const { events: liveEvents } = useLiveEvents()

  const displayEvents = liveEvents.map((evt) => ({
    id: evt.id,
    txHash: evt.txHash,
    eventName: evt.eventName ?? "Event",
    description: evt.details,
    timeAgo: evt.timestamp.toLocaleTimeString(),
  }))

  return (
    <section
      aria-labelledby="feed-heading"
      className="flex max-h-[440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-card/90 via-card/75 to-card/50 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/30"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <h2
            id="feed-heading"
            className="text-base font-bold tracking-tight text-foreground"
          >
            On-Chain Event Feed
          </h2>
          <span className="rounded-full border border-white/10 bg-secondary/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {displayEvents.length}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 shadow-sm">
          <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
        <ol className="flex flex-col">
          {displayEvents.length === 0 && (
            <li className="py-8 text-center font-mono text-xs text-muted-foreground">
              No events yet — commission a job to see them appear.
            </li>
          )}
          {displayEvents.map((event, index) => {
            const meta = EVENT_META[event.eventName] ?? EVENT_META.JobCreated
            const isLast = index === displayEvents.length - 1

            return (
              <li key={event.id} className="flex gap-3">
                {/* timeline rail */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border',
                      meta.tone,
                    )}
                  >
                    {meta.icon}
                  </span>
                  {!isLast && (
                    <span
                      className="my-1 w-px flex-1 bg-white/10"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className={cn('min-w-0 flex-1', !isLast && 'pb-4')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">
                      {event.eventName}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {event.timeAgo}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground/90">
                    {event.description}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      Tx
                    </span>
                    <code className="min-w-0 flex-1 truncate rounded-md border border-white/5 bg-secondary/50 px-2 py-0.5 font-mono text-[10px] text-foreground/80">
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
      </div>
    </section>
  )
}
