import { Wallet, Activity, TrendingUp } from 'lucide-react'
import { AgentCard } from '@/components/agentrail/agent-card'
import { JobEscrowManager } from '@/components/agentrail/job-escrow-manager'
import { EventFeed } from '@/components/agentrail/event-feed'
import { AGENTS, METRICS, formatUsdc } from '@/lib/agentrail-data'

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </div>
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-lg font-semibold text-foreground">
          {value}
          {unit ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

export function DashboardView() {
  return (
    <div className="space-y-6">
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="size-5" aria-hidden="true" />}
            label="Total Escrowed"
            value={formatUsdc(METRICS.totalEscrowed)}
            unit="USDC"
          />
          <Metric
            icon={<Activity className="size-5" aria-hidden="true" />}
            label="Active Jobs"
            value={String(METRICS.activeJobs)}
          />
          <Metric
            icon={<TrendingUp className="size-5" aria-hidden="true" />}
            label="Registered Agents"
            value="6"
          />
        </div>
      </section>

      <section aria-label="Agent profiles">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {AGENTS.map((agent) => (
            <AgentCard key={agent.identityTokenId} agent={agent} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <JobEscrowManager />
        </div>
        <div className="lg:col-span-1">
          <EventFeed />
        </div>
      </div>
    </div>
  )
}
