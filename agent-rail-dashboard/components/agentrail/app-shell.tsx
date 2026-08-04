'use client'

import { useState } from 'react'
import { TopNav, type TabId } from './top-nav'
import { CreateJobModal } from './create-job-modal'
import { DashboardView } from './views/dashboard-view'
import { RegistryView } from './views/registry-view'
import { JobsView } from './views/jobs-view'
import { EvaluatorView } from './views/evaluator-view'

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [walletConnected, setWalletConnected] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        walletConnected={walletConnected}
        onConnectWallet={() => setWalletConnected(true)}
        onCreateJob={() => setCreateOpen(true)}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'registry' && <RegistryView />}
        {activeTab === 'jobs' && <JobsView />}
        {activeTab === 'evaluator' && <EvaluatorView />}
      </main>

      <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
