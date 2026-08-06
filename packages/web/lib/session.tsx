'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePrivy } from '@privy-io/react-auth'

/// Who is using the app, and how a request proves it. Member 4.
///
/// One interface over two ways of signing in: Privy when it is configured, and a
/// local identity when it is not, so the demo still runs without a Privy account
/// and without the ownership rules going untested. Everything downstream reads
/// this context and cannot tell which is behind it.
///
/// The server decides which to trust — lib/owner.ts accepts the unverified local
/// identity only while no Privy app is configured. Both halves therefore switch
/// on the same value, and cannot end up disagreeing about whether logins are
/// real.

export interface Session {
  /// False until the sign-in state is known. Rendering "signed out" before this
  /// makes a returning user's session flash as absent on every load.
  ready: boolean
  signedIn: boolean
  /// Stable identifier for the person — a Privy DID in the configured case.
  /// Opaque: nothing outside this file reads its shape.
  owner: string | null
  /// Their wallet, when they have one. Email users may not, which is why this is
  /// separate from `owner` rather than being it.
  address: `0x${string}` | null
  signIn: () => void
  signOut: () => Promise<void>
  /// Credentials for a request to our own API, resolved per call because an
  /// access token expires and Privy refreshes it.
  authHeaders: () => Promise<Record<string, string>>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <Providers>')
  return session
}

/// fetch that carries the caller's identity. Used for every /api/runtime call —
/// a route reached without it acts anonymously, which shows up as somebody's own
/// agents appearing to belong to nobody.
export function useAuthedFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  const { authHeaders } = useSession()
  return useCallback(
    async (input, init) => {
      const auth = await authHeaders()
      return fetch(input, { ...init, headers: { ...init?.headers, ...auth } })
    },
    [authHeaders],
  )
}

export function PrivySession({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy()

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAccessToken()
    return token ? { authorization: `Bearer ${token}` } : {}
  }, [getAccessToken])

  const value = useMemo<Session>(
    () => ({
      ready,
      signedIn: authenticated,
      // The DID, not the wallet. It is what the access token proves, and it
      // survives the user linking, changing or never having a wallet.
      owner: authenticated && user ? user.id : null,
      address: (user?.wallet?.address as `0x${string}` | undefined) ?? null,
      signIn: login,
      signOut: logout,
      authHeaders,
    }),
    [ready, authenticated, user, login, logout, authHeaders],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

const LOCAL_KEY = 'agentrail.local-identity'

/// Sign-in without Privy, for running the demo locally.
///
/// Deliberately not a wallet connection: the point is to have a stable identity
/// to own agents with, and asking for a wallet to get one would suggest the
/// wallet is what ownership rests on. It rests on nothing here — the server
/// takes this identity on trust, and only because Privy is not configured.
export function LocalSession({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // localStorage is read after mount, never during render: the server renders
  // this too, and reading it there would either crash or produce markup that
  // disagrees with the browser's.
  useEffect(() => {
    setOwner(window.localStorage.getItem(LOCAL_KEY))
    setReady(true)
  }, [])

  const signIn = useCallback(() => {
    const existing = window.localStorage.getItem(LOCAL_KEY)
    const identity = existing ?? `local:${crypto.randomUUID()}`
    window.localStorage.setItem(LOCAL_KEY, identity)
    setOwner(identity)
  }, [])

  const signOut = useCallback(async () => {
    // Kept, not cleared: signing out must not orphan the agents this identity
    // created, and locally there is no way to recover it once gone.
    setOwner(null)
  }, [])

  const value = useMemo<Session>(
    () => ({
      ready,
      signedIn: owner !== null,
      owner,
      address: null,
      signIn,
      signOut,
      authHeaders: async (): Promise<Record<string, string>> =>
        owner ? { 'x-agent-owner': owner } : {},
    }),
    [ready, owner, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
