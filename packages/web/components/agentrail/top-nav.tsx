'use client'

import { useEffect, useRef, useState } from 'react'
import {
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
import { truncateHex } from '@/lib/agentrail-data'
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
  connectedAddress,
  onConnectWallet,
  onDisconnectWallet,
  onCreateJob,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  connectedAddress: `0x${string}` | null
  onConnectWallet: () => void
  onDisconnectWallet: () => void
  onCreateJob: () => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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
              Hardhat Local
              <span className="font-mono text-success/80">Chain 31337</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {connectedAddress ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src="/MetaMask-icon-fox-with-margins.svg"
                    alt="MetaMask"
                    className="size-4 shrink-0"
                  />
                  <span className="font-mono text-sm text-foreground">
                    {truncateHex(connectedAddress, 6, 4)}
                  </span>
                  <span className="hidden rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary sm:inline">
                    ERC-7579 Active
                  </span>
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
                        Connected Account
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <code className="truncate font-mono text-xs text-foreground">
                          {connectedAddress}
                        </code>
                        <button
                          type="button"
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
                      <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground rounded-lg bg-secondary/30">
                        <span>Network</span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-success">
                          <span className="size-1.5 rounded-full bg-success" />
                          Hardhat (31337)
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
                        Disconnect Wallet
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
