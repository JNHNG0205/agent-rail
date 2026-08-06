import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Bot, Store } from 'lucide-react'
import { CATEGORY_LABELS, type ServiceCategory } from '@agentrail/shared'
import { type Agent, formatUsdc, truncateHex } from '@/lib/agentrail-data'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<Agent['role'], string> = {
  client: 'bg-primary/15 text-primary',
  provider: 'bg-success/15 text-success',
  evaluator: 'bg-warning/15 text-warning',
  unknown: 'bg-muted text-muted-foreground',
}

const ROLE_LABEL: Record<Agent['role'], string> = {
  client: 'Client',
  provider: 'Provider',
  evaluator: 'Evaluator',
  // A registered identity the runtime does not host — nobody is running it.
  unknown: 'Not hosted',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

/// One agent, showing only what the system can actually produce.
///
/// Reputation is ReputationRegistry's completed-job count, read from the chain.
/// There is no star rating, attestation count or specialty, because nothing
/// records them — every number here has a source behind it.
export function AgentCard({
  agent,
  showIdentity = true,
  onWithdraw,
  onDeposit,
}: {
  agent: Agent
  /// The identity token id and the agent's address. True in the registry, where
  /// on-chain identity is the subject; false on someone's own dashboard, which
  /// answers "what do I have and what is it doing" — nobody sends funds to an
  /// agent by hand, so an address there is a number to scroll past.
  showIdentity?: boolean
  /// Offered only where the agent is the viewer's own. Absent in the public
  /// registry, where the balances belong to other people.
  onWithdraw?: (agent: Agent) => void
  /// Putting your own USDC in. Signed by the viewer's wallet, not the server.
  onDeposit?: (agent: Agent) => void
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h3 className="text-base font-semibold text-foreground">{agent.name}</h3>
            <span
              className={cn(
                'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                ROLE_TONE[agent.role],
              )}
            >
              {ROLE_LABEL[agent.role]}
            </span>
          </div>
        </div>
        {showIdentity && agent.tokenId !== undefined && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5">
            <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
            <span className="font-mono text-xs text-foreground">#{agent.tokenId}</span>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Field label="Jobs completed">
          <p className="text-xl font-semibold tabular-nums text-foreground">
            {agent.reputation}
          </p>
        </Field>

        <Field label="USDC Balance">
          <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {agent.usdcBalance !== undefined ? `${formatUsdc(agent.usdcBalance)} USDC` : '—'}
          </p>
        </Field>
      </div>

      {/* Only on your own agents. Withdrawing needs something to take;
          depositing does not, and an empty agent is exactly when you want it. */}
      {(onWithdraw || onDeposit) && (
        <div className="mt-3 flex gap-2">
          {onDeposit && (
            <button
              type="button"
              onClick={() => onDeposit(agent)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
              Deposit
            </button>
          )}
          {onWithdraw && agent.usdcBalance !== undefined && agent.usdcBalance > 0n && (
            <button
              type="button"
              onClick={() => onWithdraw(agent)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              Withdraw
            </button>
          )}
        </div>
      )}

      {agent.service && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
          <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
            <Store className="size-3" /> Sells for {agent.service.priceUsdc} USDC
            {agent.service.category && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] normal-case">
                {CATEGORY_LABELS[agent.service.category as ServiceCategory] ?? agent.service.category}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-foreground">{agent.service.summary}</p>
        </div>
      )}

      {showIdentity && (
      <div className="mt-4 border-t border-border pt-4">
        <Field label="Wallet Address">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/60 px-2.5 py-1.5 font-mono text-sm text-foreground">
              {truncateHex(agent.address, 10, 8)}
            </code>
            <CopyButton value={agent.address} label="Copy wallet address" />
          </div>
        </Field>
      </div>
      )}
    </article>
  )
}
