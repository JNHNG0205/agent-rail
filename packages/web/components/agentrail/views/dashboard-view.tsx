"use client";

import { Wallet, Activity, TrendingUp } from 'lucide-react'
import { AgentCard } from '@/components/agentrail/agent-card'
import { JobEscrowManager } from '@/components/agentrail/job-escrow-manager'
import { EventFeed } from '@/components/agentrail/event-feed'
import { AGENTS, METRICS, formatUsdc } from '@/lib/agentrail-data'
import { useAgentData } from '@/hooks/useAgentData'
import { useJobs } from '@/hooks/useJobs'

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
  const { agents: liveAgents } = useAgentData()
  const { jobs: liveJobs } = useJobs()

  const displayAgents = liveAgents.map((a, idx) => ({
    address: a.address,
    label: `Agent ${idx === 0 ? "A" : idx === 1 ? "B" : "C"}`,
    name: `Agent ${idx === 0 ? "A" : idx === 1 ? "B" : "C"}`,
    role: (idx === 0 ? "Buyer" : idx === 1 ? "Provider" : "Evaluator") as "Buyer" | "Provider" | "Evaluator",
    identityTokenId: a.tokenId ? Number(a.tokenId) : idx + 1,
    tokenId: a.tokenId ? Number(a.tokenId) : idx + 1,
    reputation: a.liveReputation !== undefined ? Number(a.liveReputation) : 0,
    reputationJobs: 0,
    completedJobs: 0,
    ratingAverage: 0,
    specialty: idx === 0 ? "Task Poster" : idx === 1 ? "Task Worker" : "Evaluator Module",
    attestations: 0,
    usdcBalance: a.usdcBalance !== undefined ? a.usdcBalance : 0n,
  }))

  const totalEscrowUsdc = liveJobs.reduce((acc, j) => acc + BigInt(j.amount), 0n)
  const activeJobsCount = liveJobs.filter((j) => j.state === 0 || j.state === 1 || j.state === 2).length

  return (
    <div className="space-y-6">
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="size-5" aria-hidden="true" />}
            label="Total Escrowed"
            value={formatUsdc(totalEscrowUsdc)}
            unit="USDC"
          />
          <Metric
            icon={<Activity className="size-5" aria-hidden="true" />}
            label="Active Jobs"
            value={String(activeJobsCount)}
          />
          <Metric
            icon={<TrendingUp className="size-5" aria-hidden="true" />}
            label="Registered Agents"
            value={String(displayAgents.length)}
          />
        </div>
      </section>

      <section aria-label="Agent profiles">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayAgents.map((agent) => (
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
