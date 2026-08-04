'use client'

import { useEffect, useState } from 'react'
import { X, Wallet, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface ConnectWalletModalProps {
  open: boolean
  onClose: () => void
  onConnect: (address: `0x${string}`) => void
}

export function ConnectWalletModal({
  open,
  onClose,
  onConnect,
}: ConnectWalletModalProps) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  async function connectMetaMask() {
    setConnecting(true)
    setError(null)
    try {
      if (typeof window === 'undefined' || !(window as unknown as { ethereum?: unknown }).ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask extension.')
      }

      const ethereum = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum

      // Request account access
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found.')
      }

      const userAccount = accounts[0] as `0x${string}`

      // Request chain switch to Hardhat 31337
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }], // 31337 in hex
        })
      } catch (switchError: unknown) {
        // Error 4902: Chain not added to wallet
        if (typeof switchError === 'object' && switchError !== null && 'code' in switchError && (switchError as { code: number }).code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7a69',
                chainName: 'Hardhat Local',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              },
            ],
          })
        }
      }

      onConnect(userAccount)
      onClose()
    } catch (err: unknown) {
      console.error('[ConnectWalletModal] Connection failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect MetaMask.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-foreground">
                Connect Wallet
              </h2>
              <p className="text-xs text-muted-foreground">
                Select your preferred browser wallet option.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-5">
          <button
            type="button"
            onClick={connectMetaMask}
            disabled={connecting}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {/* Render high-res MetaMask logo */}
              <div className="flex size-10 items-center justify-center rounded-lg bg-background border border-border/60 p-1.5 shadow-sm">
                <img
                  src="/MetaMask-icon-fox-with-margins.svg"
                  alt="MetaMask Logo"
                  className="size-7 shrink-0 object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">MetaMask</p>
                <p className="text-xs text-muted-foreground">
                  Browser extension &amp; mobile wallet
                </p>
              </div>
            </div>
            {connecting ? (
              <span className="text-xs text-primary animate-pulse font-medium">
                Connecting...
              </span>
            ) : (
              <CheckCircle2 className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
