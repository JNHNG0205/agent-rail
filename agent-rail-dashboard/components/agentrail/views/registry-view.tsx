'use client'

import { Bot, BadgeCheck, Star, Plus, ScrollText } from 'lucide-react'
import {
  REGISTERED_AGENTS,
  type RegisteredAgent,
  truncateHex,
} from '@/lib/agentrail-data'
import { CopyButton } from '@/components/agentrail/copy-button'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<RegisteredAgent['role'], string> = {
  Buyer: 'bg-primary/15 text-primary',
  Worker: 'bg-success/15 text-success',
  Evaluator: 'bg-warning/15 text-warning',
}

function AgentRegistryCard({ agent }: { agent: RegisteredAgent }) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h3 className="text-base font-semibold text-foreground">
              {agent.name}
            </h3>
            <span
              className={cn(
                'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                ROLE_TONE[agent.role],
              )}
            >
              {agent.role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5">
          <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
          <span className="font-mono text-xs text-foreground">
            #{agent.tokenId}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{agent.specialty}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Reputation
          </p>
          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
            {agent.reputation}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Completed
          </p>
          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
            {agent.completedJobs}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Rating
          </p>
          <p className="flex items-center gap-1 font-mono text-base font-semibold tabular-nums text-foreground">
            <Star
              className="size-3.5 fill-warning text-warning"
              aria-hidden="true"
            />
            {agent.ratingAverage.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <ScrollText
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="text-xs text-muted-foreground">
          On-chain attestations
        </span>
        <span className="ml-auto font-mono text-sm font-semibold text-foreground">
          {agent.attestations.toLocaleString()}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/60 px-2.5 py-1.5 font-mono text-xs text-foreground">
          {truncateHex(agent.address, 10, 8)}
        </code>
        <CopyButton value={agent.address} label="Copy agent address" />
      </div>
    </article>
  )
}

export function RegistryView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Agents &amp; Registry
          </h1>
          <p className="text-sm text-muted-foreground">
            ERC-8004 identity NFTs with portable reputation &amp; attestations.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="size-4" aria-hidden="true" />
          Mint New Agent NFT
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REGISTERED_AGENTS.map((agent) => (
          <AgentRegistryCard key={agent.tokenId} agent={agent} />
        ))}
      </div>
    </div>
  )
}
