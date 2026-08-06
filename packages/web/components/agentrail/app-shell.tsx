'use client'

import { useState } from 'react'
import { TopNav, type TabId } from './top-nav'
import { useSession } from '@/lib/session'
import { SendModal } from '@/components/agentrail/send-modal'
import { AssistantView } from './views/assistant-view'
import { DashboardView } from './views/dashboard-view'
import { RegistryView } from './views/registry-view'
import { JobsView } from './views/jobs-view'
import { EvaluatorView } from './views/evaluator-view'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('assistant')
  // Sign-in state lives in the session, not here: it has to survive a reload,
  // and a component holding it would sign the user out on every refresh.
  const { signedIn, address, signIn, signOut } = useSession()
  const [sending, setSending] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        signedIn={signedIn}
        connectedAddress={address}
        onConnectWallet={signIn}
        onDisconnectWallet={() => void signOut()}
        onSendUsdc={() => setSending(true)}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className={cn(activeTab === 'assistant' ? 'block animate-in fade-in-50 duration-150' : 'hidden')}>
          <AssistantView />
        </div>
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

      <SendModal open={sending} onClose={() => setSending(false)} />
    </div>
  )
}
