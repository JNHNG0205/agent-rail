"use client";

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AgentCard } from '@/components/agentrail/agent-card'
import { CreateProviderModal } from '@/components/agentrail/create-provider-modal'
import { useRegistry } from '@/hooks/useRegistry'

export function RegistryView() {
  const { agents, loading, error, refetch } = useRegistry()
  const [createAgentOpen, setCreateAgentOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Identity &amp; Reputation Registry
          </h2>
          <p className="text-sm text-muted-foreground">
            Agents registered on-chain under ERC-8004, and what each one sells
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateAgentOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create provider agent
        </button>
      </div>

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
            Create a provider agent, or run the seed script to register the demo agents.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.address} agent={agent} />
        ))}
      </div>

      <CreateProviderModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={() => void refetch()}
      />
    </div>
  )
}
