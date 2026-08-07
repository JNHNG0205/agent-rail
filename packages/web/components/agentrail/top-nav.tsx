'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  LayoutDashboard,
  Users,
  Gauge,
  Layers,
  Wallet,
  Plus,
  ChevronDown,
  Copy,
  Check,
  LogOut,
  Send,
  ExternalLink,
} from 'lucide-react'
import { formatUsdc, truncateHex } from '@/lib/agentrail-data'
import { CHAIN_NAME, CHAIN_ID } from '@agentrail/shared'
import { useWalletStatus } from '@/hooks/useWalletStatus'
import { useAdmin } from '@/hooks/useAdmin'
import { cn } from '@/lib/utils'

export type TabId = 'assistant' | 'dashboard' | 'registry' | 'admin'

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
    label: 'Marketplace',
    icon: <Users className="size-4" aria-hidden="true" />,
  },
  {
    id: 'admin',
    label: 'Network admin',
    icon: <Gauge className="size-4" aria-hidden="true" />,
  },
]

export function TopNav({
  activeTab,
  onTabChange,
  signedIn,
  connectedAddress,
  onConnectWallet,
  onDisconnectWallet,
  onSendUsdc,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  /// Signed in, which is separate from holding a wallet: someone who signed in
  /// with an email owns agents and hires with them without ever having one.
  signedIn: boolean
  connectedAddress: `0x${string}` | null
  onConnectWallet: () => void
  onDisconnectWallet: () => void
  /// Move USDC out of the viewer's own wallet, to anywhere. Offered here
  /// because this menu is where the balance is, and that is where somebody
  /// looks for the way to spend it.
  onSendUsdc: () => void
}) {
  // Hidden rather than shown-and-refused: a tab that always says no is a tab
  // that teaches people to ignore the navigation. The page behind it refuses on
  // its own, so this is presentation, not the control.
  const { admin } = useAdmin()
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
    <header className="masthead-in sticky top-0 z-30 border-b border-rail/15 bg-rail text-rail-foreground shadow-[0_1px_0_rgba(12,17,22,0.06),0_10px_30px_-24px_rgba(12,17,22,0.8)]">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top row: logo + chain + wallet/create */}
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_rgba(37,99,235,0.55)]">
                <Layers className="size-5" aria-hidden="true" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight text-rail-foreground">
                AgentRail
              </span>
            </div>

            <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-rail-foreground/90 sm:inline-flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--state-settled)] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--state-settled)]" />
              </span>
              {CHAIN_NAME}
              <span className="font-mono text-rail-foreground/60">Chain {CHAIN_ID}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-rail"
                >
                  <Wallet className="size-4 shrink-0 text-rail-foreground/60" aria-hidden="true" />
                  <span className="font-mono text-sm text-rail-foreground">
                    {connectedAddress ? truncateHex(connectedAddress, 6, 4) : 'Signed in'}
                  </span>
                  {connectedAddress && (
                    <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-rail-foreground/70 sm:inline">
                      {walletStatus.isRegisteredAgent ? 'Registered agent' : 'Observer'}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'size-3.5 text-rail-foreground/60 transition-transform',
                      dropdownOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {/* Wallet Dropdown Popover */}
                {dropdownOpen && (
                  <div className="sheet absolute right-0 z-50 mt-2 w-64 p-3 text-foreground shadow-[0_18px_40px_-16px_rgba(12,17,22,0.45)]">
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
                            <Check className="size-3.5 text-[var(--state-settled)]" />
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

                      {connectedAddress && walletStatus.usdcBalance !== null && walletStatus.usdcBalance > 0n && (

                        <button

                          type="button"

                          onClick={() => {

                            onSendUsdc()

                            setDropdownOpen(false)

                          }}

                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"

                        >

                          <Send className="size-3.5" aria-hidden="true" />

                          Send USDC

                        </button>

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
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--state-settled)]">
                          <span className="size-1.5 rounded-full bg-[var(--state-settled)]" />
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
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-rail"
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
          {TABS.filter((tab) => tab.id !== 'admin' || admin).map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-rail',
                  isActive
                    ? 'border-primary text-rail-foreground'
                    : 'border-transparent text-rail-foreground/55 hover:text-rail-foreground/90',
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
