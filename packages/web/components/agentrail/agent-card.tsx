import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Bot, Store } from 'lucide-react'
import { CATEGORY_LABELS, type ServiceCategory } from '@agentrail/shared'
import { type Agent, formatUsdc, truncateHex } from '@/lib/agentrail-data'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<Agent['role'], string> = {
  client: 'border-primary/30 bg-primary/10 text-primary shadow-sm',
  provider: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm',
  evaluator: 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm',
  unknown: 'border-muted bg-muted/20 text-muted-foreground',
}

const ROLE_LABEL: Record<Agent['role'], string> = {
  client: 'Client',
  provider: 'Provider',
  evaluator: 'Evaluator',
  unknown: 'Not hosted',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

export function AgentCard({
  agent,
  showIdentity = true,
  onWithdraw,
  onDeposit,
}: {
  agent: Agent
  showIdentity?: boolean
  onWithdraw?: (agent: Agent) => void
  onDeposit?: (agent: Agent) => void
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-card/90 via-card/75 to-card/50 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner transition-transform duration-300 group-hover:scale-105">
            <Bot className="size-6" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h3 className="text-base font-bold text-foreground tracking-tight">{agent.name}</h3>
            <span
              className={cn(
                'mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
                ROLE_TONE[agent.role],
              )}
            >
              {ROLE_LABEL[agent.role]}
            </span>
          </div>
        </div>
        {showIdentity && agent.tokenId !== undefined && (
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 shadow-sm">
            <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-foreground">#{agent.tokenId}</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-secondary/30 p-4">
        <Field label="Jobs completed">
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {agent.reputation}
          </p>
        </Field>

        <Field label="USDC Balance">
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {agent.usdcBalance !== undefined ? `${formatUsdc(agent.usdcBalance)} USDC` : '—'}
          </p>
        </Field>
      </div>

      {(onWithdraw || onDeposit) && (
        <div className="mt-4 flex gap-2.5">
          {onDeposit && (
            <button
              type="button"
              onClick={() => onDeposit(agent)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:bg-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowDownLeft className="size-4" aria-hidden="true" />
              Deposit
            </button>
          )}
          {onWithdraw && agent.usdcBalance !== undefined && agent.usdcBalance > 0n && (
            <button
              type="button"
              onClick={() => onWithdraw(agent)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
              Withdraw
            </button>
          )}
        </div>
      )}

      {agent.service && (
        <div className="mt-4 rounded-xl border border-white/5 bg-secondary/40 p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            <Store className="size-3 text-primary" /> Sells for {agent.service.priceUsdc} USDC
            {agent.service.category && (
              <span className="ml-auto rounded-full border border-white/10 bg-secondary px-2 py-0.5 text-[10px] font-normal normal-case">
                {CATEGORY_LABELS[agent.service.category as ServiceCategory] ?? agent.service.category}
              </span>
            )}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{agent.service.summary}</p>
        </div>
      )}

      {showIdentity && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <Field label="Wallet Address">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-white/5 bg-secondary/60 px-3 py-1.5 font-mono text-xs text-foreground">
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

