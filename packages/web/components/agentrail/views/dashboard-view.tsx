"use client";

import { useState } from 'react'
import { Wallet, Activity, TrendingUp } from 'lucide-react'
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
  const { mine, refetch } = useRegistry()
  // Wider than the default: these figures are filtered down to your agents, and
  // a page of recent jobs can hold none of yours while yours sit just outside it.
  const { jobs: liveJobs } = useJobs({ limit: 200 })
  const { signedIn, signIn } = useSession()
  // Which agent the deposit dialog is for; null when it is closed.
  const [depositing, setDepositing] = useState<Agent | null>(null)
  // Which agent each dialog is for; null when closed.
  const [withdrawing, setWithdrawing] = useState<Agent | null>(null)

  // Your dashboard, not the system's. The marketplace is on the Agents tab,
  // where seeing everyone is the point; here, other people's agents and their
  // escrow are somebody else's business shown as if it were yours.
  const myAddresses = new Set(mine.map((a) => a.address.toLowerCase()))
  const myJobs = liveJobs.filter(
    (j) =>
      myAddresses.has(j.client.toLowerCase()) || myAddresses.has(j.provider.toLowerCase()),
  )

  // Only jobs that still hold money. Summing every job counted escrow that
  // settled or refunded weeks ago, which read as funds at stake when nothing
  // was — the figure sat at 220 USDC beside an active-job count of zero.
  const totalEscrowUsdc = myJobs
    .filter((j) => j.state === JobState.Funded || j.state === JobState.Submitted)
    .reduce((acc, j) => acc + BigInt(j.amount), 0n)
  const activeJobsCount = myJobs.filter((j) => j.state !== JobState.Terminal).length

  return (
    <div className="space-y-6">
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="size-5" aria-hidden="true" />}
            label="In Escrow Now"
            value={`${formatUsdc(totalEscrowUsdc)} USDC`}
          />
          <Metric
            icon={<Activity className="size-5" aria-hidden="true" />}
            label="Active Jobs"
            value={String(activeJobsCount)}
          />
          <Metric
            icon={<TrendingUp className="size-5" aria-hidden="true" />}
            label="Your Agents"
            value={String(mine.length)}
          />
        </div>
      </section>

      <section aria-label="Agent profiles">
        {!signedIn ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Sign in to see the agents you created. Everyone else&apos;s are on the
              Agents &amp; Registry tab — that list is public, because an agent finds
              who to hire by reading what everyone offers.
            </p>
            <Button size="sm" onClick={signIn}>
              Sign in
            </Button>
          </div>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              You have not created an agent yet. Ask your assistant for something on
              the Assistant tab, or publish a service from Agents &amp; Registry.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mine.map((agent) => (
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
          // Delayed: the balance is read from the chain, and reading it the
          // instant a transaction is submitted returns the value from before it.
          setTimeout(() => void refetch(), 6000)
        }}
      />

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
