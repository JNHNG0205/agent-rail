'use client'

import { useState } from 'react'
import { Briefcase, Lock, LogOut, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/ui/button'
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
/// An administrator account from the database, signing in with an email and a
/// password. The check is the server's — this component asks, renders the
/// answer and offers the form; the routes serving each panel check the same
/// cookie again for themselves.
///
/// Separate from signing in as a user. Somebody may be both at once, and the
/// administrator is not a person's agent-owning identity.
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
  const { admin, reason, checked, signIn, signOut } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
  }

  if (!checked) {
    return <p className="text-sm text-muted-foreground">Checking access…</p>
  }

  // Refused in the interface and refused at the source. The routes behind these
  // panels ask the same question of the same function, so removing this block in
  // a browser buys an empty page rather than the data.
  if (!admin) {
    return (
      <form onSubmit={submit} className="sheet mx-auto max-w-sm rounded-2xl p-7">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-center text-lg font-semibold tracking-tight">
          Administrator sign-in
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          These views cover the whole network rather than your own agents. Your
          own are on the Dashboard, and they need none of this.
        </p>

        <label className="mt-6 block text-sm">
          <span className="mb-1.5 block font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </label>

        <label className="mt-3 block text-sm">
          <span className="mb-1.5 block font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        {/* Shown only when there is no account to sign into, or the database
            is down. A wrong password gets the failure above and nothing more:
            telling somebody who mistyped how accounts are made is telling them
            where to look. */}
        {reason && !reason.startsWith('sign in') && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{reason}</p>
        )}
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Network admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything running on the shared contracts, rather than anything of
          yours — every job on the shared contracts, every verdict, and how the
          contracts are wired.
        </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>

      {/* A tab list, not links: both panels read the same job data, and swapping
          between them should not cost a refetch. */}
      <div
        role="tablist"
        aria-label="Network views"
        className="inline-flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {PANELS.map((p) => {
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
      <div className={cn(panel === 'contracts' ? 'block' : 'hidden')}>
        <ContractsPanel />
      </div>
    </div>
  )
}
