'use client'

import { useState } from 'react'
import { TopNav, type TabId } from './top-nav'
import { useSession } from '@/lib/session'
import { SendModal } from '@/components/agentrail/send-modal'
import { AssistantView } from './views/assistant-view'
import { DashboardView } from './views/dashboard-view'
import { RegistryView } from './views/registry-view'
import { AdminView } from './views/admin-view'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('assistant')
  // Sign-in state lives in the session, not here: it has to survive a reload,
  // and a component holding it would sign the user out on every refresh.
  const { signedIn, address, signIn, signOut } = useSession()
  const [sending, setSending] = useState(false)

  return (
    <div className="min-h-dvh">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        signedIn={signedIn}
        connectedAddress={address}
        onConnectWallet={signIn}
        onDisconnectWallet={() => void signOut()}
        onSendUsdc={() => setSending(true)}
      />

      {/* The reveal runs once, keyed to nothing. Re-triggering it on every tab
          change would turn an arrival into a stutter — the content is already
          mounted, and only its visibility changes. */}
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className={cn('rise rise-1', activeTab === 'assistant' ? 'block' : 'hidden')}>
          <AssistantView />
        </div>
        <div className={cn('rise rise-1', activeTab === 'dashboard' ? 'block' : 'hidden')}>
          <DashboardView />
        </div>
        <div className={cn('rise rise-1', activeTab === 'registry' ? 'block' : 'hidden')}>
          <RegistryView />
        </div>
        <div className={cn('rise rise-1', activeTab === 'admin' ? 'block' : 'hidden')}>
          <AdminView />
        </div>
      </main>

      <SendModal open={sending} onClose={() => setSending(false)} />
    </div>
  )
}
