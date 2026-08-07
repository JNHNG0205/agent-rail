"use client";

import { useMemo, useState } from 'react'
import { Plus, Search, Store, Bot, Fingerprint, ChevronDown } from 'lucide-react'
import { AgentCard } from '@/components/agentrail/agent-card'
import { CreateProviderModal } from '@/components/agentrail/create-provider-modal'
import { CopyButton } from '@/components/agentrail/copy-button'
import { useRegistry } from '@/hooks/useRegistry'
import { CATEGORY_LABELS, SERVICE_CATEGORIES, type ServiceCategory } from '@agentrail/shared'
import { truncateHex } from '@/lib/agentrail-data'
import type { Agent } from '@/lib/agentrail-data'

/// The registry, grouped by what a reader is here to find. Member 4.
///
/// It was one grid of identical cards in whatever order the merge produced —
/// providers you can hire beside client assistants beside chain registrations
/// that nothing runs. Fourteen cards of equal weight is a wall, and the thing
/// most people come for, "what can I hire and for how much", was somewhere in
/// the middle of it.
///
/// Three groups now, in the order they matter. Providers first, cheapest first,
/// because that is the order a client agent reads the directory in. Then
/// assistants, which hire rather than sell. Then identities that exist on chain
/// with nobody running them: real history, not offerings, so they are rows.

function Section({
  icon,
  title,
  count,
  hint,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  hint: string
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {count} · {hint}
        </span>
      </div>
      {children}
    </section>
  )
}

export function RegistryView() {
  const { agents, loading, error, refetch } = useRegistry()
  const [createAgentOpen, setCreateAgentOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ServiceCategory | 'all'>('all')

  const { providers, clients, unhosted } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (a: Agent) =>
      q.length === 0 ||
      a.name.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q) ||
      (a.service?.summary.toLowerCase().includes(q) ?? false)

    const visible = agents.filter(matches)
    // Uncategorised agents fall under "other" rather than vanishing when a
    // filter is applied — they predate categories and are still hireable.
    const inCategory = (a: Agent) =>
      category === 'all' || (a.service?.category ?? 'other') === category

    return {
      // Cheapest first — the same order a client agent reads the directory in.
      providers: visible
        .filter((a) => a.role === 'provider' && a.service && inCategory(a))
        .sort((a, b) => Number(a.service!.priceUsdc) - Number(b.service!.priceUsdc)),
      clients: visible.filter((a) => a.role === 'client'),
      // Registered on chain, hosted by nobody: nothing can act as these.
      unhosted: visible
        .filter((a) => a.role !== 'provider' && a.role !== 'client')
        .sort((a, b) => (a.tokenId ?? 0) - (b.tokenId ?? 0)),
    }
  }, [agents, query, category])

  const providerCounts = useMemo(() => {
    const sellers = agents.filter((a) => a.role === 'provider' && a.service)
    const byCategory: Partial<Record<ServiceCategory, number>> = {}
    for (const a of sellers) {
      const c = (a.service?.category ?? 'other') as ServiceCategory
      byCategory[c] = (byCategory[c] ?? 0) + 1
    }
    return { total: sellers.length, byCategory }
  }, [agents])

  const total = providers.length + clients.length + unhosted.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Agents you can hire
          </h2>
          <p className="text-sm text-muted-foreground">
            What each one sells, what it charges, and how many jobs it has finished.
            Anyone can hire any of them — the directory is public so agents can find
            each other.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateAgentOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create provider agent
        </button>
      </div>

      {agents.length > 6 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, service or address"
            aria-label="Search agents"
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus-visible:border-ring"
          />
        </div>
      )}

      {providerCounts.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', ...SERVICE_CATEGORIES] as const).map((c) => {
            const n = c === 'all' ? providerCounts.total : (providerCounts.byCategory[c] ?? 0)
            // A filter that leads to an empty page is not worth offering.
            if (n === 0 && c !== 'all') return null
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary')
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]} <span className="tabular-nums">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && agents.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading agents…</p>
      )}

      {!loading && agents.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No agents registered yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nobody has published a service yet. Create a provider agent to sell
            something — until one exists, there is nobody for an assistant to hire.
          </p>
        </div>
      )}

      {agents.length > 0 && total === 0 && (
        <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
      )}

      {!loading && providers.length === 0 && clients.length === 0 && agents.length > 0 && (
        <div className="sheet rounded-2xl border-dashed p-8 text-center">
          <p className="text-sm font-medium">Nobody is selling anything yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            The addresses below hold an identity on the chain, but the agents behind
            them run on other people&apos;s machines — so there is nothing here your
            assistant can hire. Create a provider agent and it will appear at the top
            of this page.
          </p>
        </div>
      )}

      <Section
        icon={<Store className="size-4 text-primary" aria-hidden="true" />}
        title="Available to hire"
        count={providers.length}
        hint="cheapest first"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((agent) => (
            <AgentCard key={agent.address} agent={agent} />
          ))}
        </div>
      </Section>

      <Section
        icon={<Bot className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="Assistants"
        count={clients.length}
        hint="they hire on someone's behalf, and do not sell"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((agent) => (
            <AgentCard key={agent.address} agent={agent} />
          ))}
        </div>
      </Section>

      {/* Rows, not cards. These hold an identity token and nothing runs them, so
          they are chain history rather than something on offer — giving them the
          same weight as a provider is what made this page read as noise. */}
      {unhosted.length > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-foreground">
            <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
            Registered elsewhere
            <span className="text-xs font-normal text-muted-foreground">
              {unhosted.length} · on the chain, run from somebody else&apos;s machine
            </span>
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {unhosted.map((agent) => (
            <li
              key={agent.address}
              className="flex items-center justify-between gap-3 bg-card px-4 py-2.5 text-sm"
            >
              <code className="truncate font-mono text-xs text-muted-foreground">
                {truncateHex(agent.address, 12, 10)}
              </code>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {agent.tokenId !== undefined && <span>#{agent.tokenId}</span>}
                <span>{agent.reputation} jobs</span>
                <CopyButton value={agent.address} label="Copy address" />
              </div>
            </li>
          ))}
          </ul>
        </details>
      )}

      <CreateProviderModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={() => void refetch()}
      />
    </div>
  )
}
