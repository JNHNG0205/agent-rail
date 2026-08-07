'use client'

import { useState } from 'react'
import { Briefcase, Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { JobsView } from './jobs-view'
import { EvaluatorView } from './evaluator-view'
import { ContractsPanel } from '@/components/agentrail/contracts-panel'
import { useAdmin } from '@/hooks/useAdmin'
import { cn } from '@/lib/utils'

/// The two network-wide views, gathered. Member 4.
///
/// Everything else in this application is scoped to the person using it: their
/// assistant, their agents, their escrow. These two are not — the job ledger and
/// the evaluator's rulings cover every job anyone has ever run — and sitting in
/// the same row as the personal views, they read as though they were the
/// reader's own.
///
/// Two levels behind it. An admin reads the network views; a superadmin owns the
/// deployed contracts and additionally sees how they are wired. The check is the
/// server's — this component asks and renders the answer, and the routes serving
/// each panel ask the same function again for themselves.
///
/// Worth being straight about what the gate is. Jobs and verdicts sit on public
/// contracts, so anyone willing to read the chain can reconstruct them without
/// this application; locking the page organises the interface rather than
/// keeping a secret. The evaluator's written reasoning is the exception — it is
/// stored off chain and served nowhere else, and that route refuses outright.

type Panel = 'jobs' | 'verdicts' | 'contracts'

const PANELS: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: 'jobs', label: 'All jobs', icon: <Briefcase className="size-4" aria-hidden="true" /> },
  { id: 'verdicts', label: 'Verdicts', icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
  // Superadmin only, and read-only. What an owner needs to check is that the
  // contracts still point where they should.
  { id: 'contracts', label: 'Contracts', icon: <SlidersHorizontal className="size-4" aria-hidden="true" /> },
]

export function AdminView() {
  const [panel, setPanel] = useState<Panel>('jobs')
  const { admin, superadmin, reason, checked } = useAdmin()

  if (!checked) {
    return <p className="text-sm text-muted-foreground">Checking access…</p>
  }

  // Refused in the interface and refused at the source. The routes behind these
  // panels ask the same question of the same function, so removing this block in
  // a browser buys an empty page rather than the data.
  if (!admin) {
    return (
      <div className="sheet mx-auto max-w-lg rounded-2xl p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Not your dashboard</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {reason ?? 'This account may not open the network admin views.'}
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
          Access is either the wallet that owns the deployed contracts, or an
          entry in the server&apos;s admin list. Your own agents and jobs are on
          the Dashboard, and they need none of this.
        </p>
      </div>
    )
  }

  const panels = superadmin ? PANELS : PANELS.filter((p) => p.id !== 'contracts')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Network admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything running on the shared contracts, rather than anything of
          yours.{' '}
          {superadmin
            ? 'You are signed in as the owner of the deployed contracts.'
            : 'You have read access to the network views.'}
        </p>
      </div>

      {/* A tab list, not links: both panels read the same job data, and swapping
          between them should not cost a refetch. */}
      <div
        role="tablist"
        aria-label="Network views"
        className="inline-flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {panels.map((p) => {
          const active = p.id === panel
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPanel(p.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {p.icon}
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Both stay mounted. Each holds its own filter and scroll position, and
          losing those on every switch is the cost of unmounting them. */}
      <div className={cn(panel === 'jobs' ? 'block' : 'hidden')}>
        <JobsView />
      </div>
      <div className={cn(panel === 'verdicts' ? 'block' : 'hidden')}>
        <EvaluatorView />
      </div>
      {superadmin && (
        <div className={cn(panel === 'contracts' ? 'block' : 'hidden')}>
          <ContractsPanel />
        </div>
      )}
    </div>
  )
}
