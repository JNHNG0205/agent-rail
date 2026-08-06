'use client'

import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { PrivySession, LocalSession } from '@/lib/session'
import { chain } from '@/lib/viem'

/// Sign-in, wired up. Member 4.
///
/// Both identifiers below are public — Privy publishes the app id in every
/// token's audience, and the client id identifies the app to Privy, not the app
/// to a user. Neither authorises anything on its own, which is why they can be
/// NEXT_PUBLIC_ and committed to .env.example.
///
/// With no app id configured the Privy provider is not mounted at all. Mounting
/// it with an empty id fails at run time, and more importantly the server makes
/// the same decision from the same variable: either logins are real on both
/// sides or neither.

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''
const CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? ''

export function Providers({ children }: { children: ReactNode }) {
  if (!APP_ID) return <LocalSession>{children}</LocalSession>

  return (
    <PrivyProvider
      appId={APP_ID}
      clientId={CLIENT_ID || undefined}
      config={{
        // Email as well as a wallet: someone hiring an agent is buying a
        // service, and requiring a browser extension to do it would exclude
        // exactly the people the marketplace is for. The agents hold their own
        // accounts and pay their own gas, so a user needs no wallet to take part.
        loginMethods: ['wallet', 'email'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
          walletChainType: 'ethereum-only',
        },
        // The chain this app settles on, so an embedded wallet is created and
        // shown on it. Without this Privy defaults to Ethereum mainnet, and
        // someone looking for the USDC their agent just sent finds an empty
        // wallet on the wrong network — the funds are fine, the view is not.
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      <PrivySession>{children}</PrivySession>
    </PrivyProvider>
  )
}
