"use client";

import { useState } from 'react'
import { Bot, BadgeCheck, Star, ShieldCheck, Wallet, Plus } from 'lucide-react'
import {
  REGISTERED_AGENTS,
  type RegisteredAgent,
  formatUsdc,
  truncateHex,
} from '@/lib/agentrail-data'
import { useAgentData } from '@/hooks/useAgentData'
import { CopyButton } from '@/components/agentrail/copy-button'
import { CreateAgentModal } from '@/components/CreateAgentModal'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<RegisteredAgent['role'], string> = {
  Buyer: 'bg-primary/15 text-primary',
  Provider: 'bg-success/15 text-success',
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
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
            ERC-8004 #{agent.tokenId}
          </span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{agent.specialty}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-border bg-secondary/40 p-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Reputation
          </p>
          <div className="mt-1 flex items-center gap-1 font-semibold text-foreground">
            <Star className="size-3.5 fill-warning text-warning" />
            <span>{agent.reputation}</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Jobs Done
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {agent.completedJobs}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Rating
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {agent.ratingAverage} ★
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="size-3.5" />
            USDC Balance
          </span>
          <span className="font-mono font-semibold text-foreground">
            {formatUsdc(agent.usdcBalance)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            On-Chain Attestations
          </span>
          <span className="font-mono text-foreground">{agent.attestations} Verified</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/60 p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
          {truncateHex(agent.address, 10, 8)}
        </code>
        <CopyButton value={agent.address} label="Copy agent address" />
      </div>
    </article>
  )
}

export function RegistryView() {
  const { agents: liveAgents, refetch } = useAgentData()
  const [createAgentOpen, setCreateAgentOpen] = useState(false)

  const displayAgents: RegisteredAgent[] = liveAgents.length > 0
    ? liveAgents.map((a, idx) => ({
        address: a.address,
        label: `Agent ${idx === 0 ? "A" : idx === 1 ? "B" : "C"}`,
        name: `Agent ${idx === 0 ? "A (Client)" : idx === 1 ? "B (Worker)" : "C (Evaluator)"}`,
        role: (idx === 0 ? "Buyer" : idx === 1 ? "Worker" : "Evaluator") as RegisteredAgent["role"],
        identityTokenId: a.tokenId ? Number(a.tokenId) : idx + 1,
        tokenId: a.tokenId ? Number(a.tokenId) : idx + 1,
        reputation: a.liveReputation !== undefined ? Number(a.liveReputation) : Number(a.reputation || 0),
        reputationJobs: 10,
        completedJobs: 10,
        ratingAverage: 4.9,
        specialty: idx === 0 ? "ERC-8183 Job Poster & Escrow Client" : idx === 1 ? "AI Worker & Deliverable Generator" : "ERC-7579 Evaluator Module & Signature Verifier",
        attestations: 12,
        usdcBalance: a.usdcBalance !== undefined ? a.usdcBalance : 500000000n,
      }))
    : REGISTERED_AGENTS

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Identity &amp; Reputation Registry
          </h2>
          <p className="text-sm text-muted-foreground">
            On-chain registered AI agents under ERC-8004 standard
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateAgentOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Mint New Agent NFT
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {displayAgents.map((agent) => (
          <AgentRegistryCard key={agent.address} agent={agent} />
        ))}
      </div>

      <CreateAgentModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onAgentCreated={() => {
          if (refetch) refetch()
        }}
      />
    </div>
  )
}
