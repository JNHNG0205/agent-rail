'use client'

import {
  LayoutDashboard,
  Users,
  Briefcase,
  ShieldCheck,
  Layers,
  Wallet,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { CONNECTED_WALLET, truncateHex } from '@/lib/agentrail-data'
import { cn } from '@/lib/utils'

export type TabId = 'dashboard' | 'registry' | 'jobs' | 'evaluator'

export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
  },
  {
    id: 'registry',
    label: 'Agents & Registry',
    icon: <Users className="size-4" aria-hidden="true" />,
  },
  {
    id: 'jobs',
    label: 'Escrow Jobs',
    icon: <Briefcase className="size-4" aria-hidden="true" />,
  },
  {
    id: 'evaluator',
    label: 'Evaluator Suite',
    icon: <ShieldCheck className="size-4" aria-hidden="true" />,
  },
]

export function TopNav({
  activeTab,
  onTabChange,
  walletConnected,
  onConnectWallet,
  onCreateJob,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  walletConnected: boolean
  onConnectWallet: () => void
  onCreateJob: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top row: logo + chain + wallet/create */}
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers className="size-5" aria-hidden="true" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                AgentRail
              </span>
            </div>

            <span className="hidden items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success sm:inline-flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Hardhat Local
              <span className="font-mono text-success/80">Chain 31337</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {walletConnected ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-secondary text-primary">
                  <Wallet className="size-3.5" aria-hidden="true" />
                </span>
                <span className="font-mono text-sm text-foreground">
                  {truncateHex(CONNECTED_WALLET.address, 6, 4)}
                </span>
                <span className="hidden rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary sm:inline">
                  ERC-7579 Active
                </span>
                <ChevronDown
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectWallet}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Wallet className="size-4" aria-hidden="true" />
                Connect Wallet
              </button>
            )}

            <button
              type="button"
              onClick={onCreateJob}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create Escrow Job</span>
              <span className="sm:hidden">New Job</span>
            </button>
          </div>
        </div>

        {/* Tab row */}
        <nav
          aria-label="Primary"
          className="-mb-px flex gap-1 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
