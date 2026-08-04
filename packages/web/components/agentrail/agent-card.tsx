import { BadgeCheck, Bot, Star } from 'lucide-react'
import { type Agent, formatUsdc, truncateHex } from '@/lib/agentrail-data'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

export function AgentCard({ agent }: { agent: Agent }) {
  const isBuyer = agent.role === 'Buyer'

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h3 className="text-base font-semibold text-foreground">
              {agent.label}
            </h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                isBuyer
                  ? 'bg-primary/15 text-primary'
                  : 'bg-success/15 text-success',
              )}
            >
              {agent.role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5">
          <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
          <span className="font-mono text-xs text-foreground">
            #{agent.identityTokenId}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Field label="Reputation Score">
          <div className="flex items-baseline gap-1.5">
            <Star
              className="size-4 shrink-0 translate-y-0.5 fill-warning text-warning"
              aria-hidden="true"
            />
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {agent.reputation}
            </span>
            <span className="text-xs text-muted-foreground">
              / {agent.reputationJobs} jobs
            </span>
          </div>
        </Field>

        <Field label="USDC Balance">
          <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatUsdc(agent.usdcBalance)}
          </p>
        </Field>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <Field label="Wallet Address">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/60 px-2.5 py-1.5 font-mono text-sm text-foreground">
              {truncateHex(agent.address, 10, 8)}
            </code>
            <CopyButton value={agent.address} label="Copy wallet address" />
          </div>
        </Field>
      </div>
    </article>
  )
}
