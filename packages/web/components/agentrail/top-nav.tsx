'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  LayoutDashboard,
  Users,
  Briefcase,
  ShieldCheck,
  Layers,
  Wallet,
  Plus,
  ChevronDown,
  Copy,
  Check,
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { formatUsdc, truncateHex } from '@/lib/agentrail-data'
import { CHAIN_NAME, CHAIN_ID } from '@agentrail/shared'
import { useWalletStatus } from '@/hooks/useWalletStatus'
import { cn } from '@/lib/utils'

export type TabId = 'assistant' | 'dashboard' | 'registry' | 'jobs' | 'evaluator'

export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'assistant',
    label: 'Assistant',
    icon: <Bot className="size-4" />,
  },
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
  signedIn,
  connectedAddress,
  onConnectWallet,
  onDisconnectWallet,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  /// Signed in, which is separate from holding a wallet: someone who signed in
  /// with an email owns agents and hires with them without ever having one.
  signedIn: boolean
  connectedAddress: `0x${string}` | null
  onConnectWallet: () => void
  onDisconnectWallet: () => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const walletStatus = useWalletStatus(connectedAddress)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleCopy() {
    if (!connectedAddress) return
    navigator.clipboard.writeText(connectedAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
              {CHAIN_NAME}
              <span className="font-mono text-success/80">Chain {CHAIN_ID}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-sm text-foreground">
                    {connectedAddress ? truncateHex(connectedAddress, 6, 4) : 'Signed in'}
                  </span>
                  {connectedAddress && (
                    <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
                      {walletStatus.isRegisteredAgent ? 'Registered agent' : 'Observer'}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform',
                      dropdownOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {/* Wallet Dropdown Popover */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl z-50">
                    <div className="border-b border-border/80 pb-2.5 mb-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                        {connectedAddress ? 'Connected Account' : 'Signed In'}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <code className="truncate font-mono text-xs text-foreground">
                          {connectedAddress ?? 'No wallet linked'}
                        </code>
                        <button
                          type="button"
                          disabled={!connectedAddress}
                          onClick={handleCopy}
                          title="Copy address"
                          className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {copied ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Shown again, and now it means something. This was
                          removed while a wallet could only ever hold zero —
                          agents hold their own funds and pay their own gas — so
                          a balance read as funds at stake when none were. Then
                          withdrawal gave earnings a way here, and a person who
                          has just moved money needs to see that it arrived. */}
                      {connectedAddress && (
                      <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-2 py-1.5 text-xs text-muted-foreground">
                        <span>Withdrawn to this wallet</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {walletStatus.usdcBalance !== null
                            ? `${formatUsdc(walletStatus.usdcBalance)} USDC`
                            : '—'}
                        </span>
                      </div>
                      )}

                      <p className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {!connectedAddress
                          ? 'Your agents hold their own accounts and pay their own gas, so hiring one needs no wallet of your own.'
                          : walletStatus.agentName
                            ? `This address is the agent "${walletStatus.agentName}".`
                            : walletStatus.isRegisteredAgent
                              ? 'This address holds an identity token but no agent is running for it.'
                              : 'Agents hold their own accounts and sign their own transactions, so nothing here is spent on your behalf.'}
                      </p>

                      <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-2 py-1.5 text-xs text-muted-foreground">
                        <span>Network</span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-success">
                          <span className="size-1.5 rounded-full bg-success" />
                          {CHAIN_NAME} ({CHAIN_ID})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onDisconnectWallet()
                          setDropdownOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <LogOut className="size-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectWallet}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Wallet className="size-4" aria-hidden="true" />
                Sign in
              </button>
            )}

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
