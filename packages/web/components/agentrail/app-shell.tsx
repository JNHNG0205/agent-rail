'use client'

import { useState } from 'react'
import { TopNav, type TabId } from './top-nav'
import { ConnectWalletModal } from './connect-wallet-modal'
import { CreateJobModal } from './create-job-modal'
import { DashboardView } from './views/dashboard-view'
import { RegistryView } from './views/registry-view'
import { JobsView } from './views/jobs-view'
import { EvaluatorView } from './views/evaluator-view'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [connectedAddress, setConnectedAddress] = useState<`0x${string}` | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connectedAddress={connectedAddress}
        onConnectWallet={() => setConnectOpen(true)}
        onDisconnectWallet={() => setConnectedAddress(null)}
        onCreateJob={() => setCreateOpen(true)}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className={cn(activeTab === 'dashboard' ? 'block animate-in fade-in-50 duration-150' : 'hidden')}>
          <DashboardView />
        </div>
        <div className={cn(activeTab === 'registry' ? 'block animate-in fade-in-50 duration-150' : 'hidden')}>
          <RegistryView />
        </div>
        <div className={cn(activeTab === 'jobs' ? 'block animate-in fade-in-50 duration-150' : 'hidden')}>
          <JobsView />
        </div>
        <div className={cn(activeTab === 'evaluator' ? 'block animate-in fade-in-50 duration-150' : 'hidden')}>
          <EvaluatorView />
        </div>
      </main>

      <ConnectWalletModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnect={(addr) => setConnectedAddress(addr)}
      />

      <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
