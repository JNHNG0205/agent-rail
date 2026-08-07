"use client";

import { useMemo, useState } from 'react'
import { Wallet, Activity, TrendingUp, Sparkles } from 'lucide-react'
import { AgentCard } from '@/components/agentrail/agent-card'
import { JobEscrowManager } from '@/components/agentrail/job-escrow-manager'
import { EventFeed } from '@/components/agentrail/event-feed'
import { formatUsdc, type Agent } from '@/lib/agentrail-data'
import { useRegistry } from '@/hooks/useRegistry'
import { useJobs } from '@/hooks/useJobs'
import { useSession } from '@/lib/session'
import { DepositModal } from '@/components/agentrail/deposit-modal'
import { WithdrawModal } from '@/components/agentrail/withdraw-modal'
import { Button } from '@/ui/button'
import { JobState } from '@agentrail/shared'

/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */

function Metric({
  icon,
  label,
  value,
  unit,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  badge?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-card/90 via-card/70 to-card/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:shadow-primary/5">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl transition-all duration-500 group-hover:bg-primary/10" />
      <div className="flex items-center justify-between">
        <div className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner transition-transform duration-300 group-hover:scale-105">
          {icon}
        </div>
        {badge && (
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-primary uppercase">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4 leading-tight">
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
          {value}
          {unit ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

export function DashboardView() {
  const { mine, refetch } = useRegistry()
  const { jobs: liveJobs } = useJobs({ limit: 200 })
  const { signedIn, signIn } = useSession()
  const [depositing, setDepositing] = useState<Agent | null>(null)
  const [withdrawing, setWithdrawing] = useState<Agent | null>(null)

  const ordered = useMemo(
    () =>
      [...mine].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'client' ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    [mine],
  )

  const myAddresses = new Set(mine.map((a) => a.address.toLowerCase()))
  const myJobs = liveJobs.filter(
    (j) =>
      myAddresses.has(j.client.toLowerCase()) || myAddresses.has(j.provider.toLowerCase()),
  )

  const totalEscrowUsdc = myJobs
    .filter((j) => j.state === JobState.Funded || j.state === JobState.Submitted)
    .reduce((acc, j) => acc + BigInt(j.amount), 0n)
  const activeJobsCount = myJobs.filter((j) => j.state !== JobState.Terminal).length

  return (
    <div className="space-y-8">
      {/* Overview Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Your agents
            <Sparkles className="size-4 text-primary/80" />
          </h2>
          <p className="text-xs text-muted-foreground">
            The agents you created, what they hold, and the jobs they are running.
          </p>
        </div>
      </div>

      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="size-5" aria-hidden="true" />}
            label="Held in escrow"
            value={`${formatUsdc(totalEscrowUsdc)} USDC`}
            badge="not yours to spend"
          />
          <Metric
            icon={<Activity className="size-5" aria-hidden="true" />}
            label="Jobs running now"
            value={String(activeJobsCount)}
            badge="being worked on"
          />
          <Metric
            icon={<TrendingUp className="size-5" aria-hidden="true" />}
            label="Agents you created"
            value={String(mine.length)}
            badge="they hold their own funds"
          />
        </div>
      </section>

      <section aria-label="Agent profiles" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Your Agents ({mine.length})
          </h3>
        </div>

        {!signedIn ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-card/60 p-6 backdrop-blur-md">
            <p className="text-sm text-muted-foreground">
              Sign in to see the agents you created. Everyone else&apos;s are on the
              Marketplace tab — that list is public, because an agent finds
              who to hire by reading what everyone offers.
            </p>
            <Button size="sm" onClick={signIn} className="shadow-lg shadow-primary/20">
              Sign in
            </Button>
          </div>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-card/60 p-6 backdrop-blur-md">
            <p className="text-sm text-muted-foreground">
              You have not created an agent yet. Ask your assistant for something on
              the Assistant tab, or publish a service from the Marketplace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {ordered.map((agent) => (
              <AgentCard
                key={agent.address}
                agent={agent}
                showIdentity={false}
                onWithdraw={setWithdrawing}
                onDeposit={setDepositing}
              />
            ))}
          </div>
        )}
      </section>

      <WithdrawModal
        open={withdrawing !== null}
        agent={withdrawing}
        onClose={() => setWithdrawing(null)}
        onWithdrawn={() => setTimeout(() => void refetch(), 6000)}
      />

      <DepositModal
        open={depositing !== null}
        agent={depositing}
        onClose={() => setDepositing(null)}
        onDeposited={() => {
          setTimeout(() => void refetch(), 6000)
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
