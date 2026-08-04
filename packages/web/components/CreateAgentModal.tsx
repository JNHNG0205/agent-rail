'use client'

import { useEffect, useState } from 'react'
import { X, Bot, ShieldCheck, UserCheck, Loader2 } from 'lucide-react'
import { addresses, IdentityRegistryAbi } from '@agentrail/shared'
import { getWalletClient, publicClient, chain } from '@/lib/viem'

interface CreateAgentModalProps {
  open: boolean
  onClose: () => void
  onAgentCreated?: () => void
}

export function CreateAgentModal({
  open,
  onClose,
  onAgentCreated,
}: CreateAgentModalProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'Buyer' | 'Worker' | 'Evaluator'>('Worker')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        throw new Error('Please enter a valid 42-character Ethereum address (0x...).')
      }

      const walletClient = getWalletClient(address as `0x${string}`)

      // 1. On-chain transaction: mint ERC-8004 identity NFT via registerAgent
      const hash = await walletClient.writeContract({
        address: addresses.IdentityRegistry,
        abi: IdentityRegistryAbi,
        functionName: 'registerAgent',
        args: [address as `0x${string}`],
        chain,
        account: address as `0x${string}`,
      } as never)

      setTxHash(hash)

      // 2. Wait for transaction receipt
      await publicClient.waitForTransactionReceipt({ hash })

      // 3. Post to /api/agents route to update local DB cache if available
      try {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            name: name || 'Agent Identity',
            role,
            capability: `${role} AI Agent`,
          }),
        })
      } catch (apiErr) {
        console.warn('[CreateAgentModal] /api/agents POST skipped or unhandled:', apiErr)
      }

      if (onAgentCreated) onAgentCreated()

      setTimeout(() => {
        setLoading(false)
        setName('')
        setAddress('')
        onClose()
      }, 1000)
    } catch (err: unknown) {
      console.error('[CreateAgentModal] Error minting identity NFT:', err)
      setError(err instanceof Error ? err.message : 'Failed to mint identity NFT.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-agent-modal-title"
    >
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="create-agent-modal-title"
                className="text-base font-semibold text-foreground"
              >
                Mint Agent Identity NFT
              </h2>
              <p className="text-xs text-muted-foreground">
                ERC-8004 identity registration on Hardhat node.
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label
              htmlFor="agent-name"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Agent Name
            </label>
            <input
              id="agent-name"
              type="text"
              required
              placeholder="e.g. Oracle Prime"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="agent-role"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Role / Capability
            </label>
            <select
              id="agent-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'Buyer' | 'Worker' | 'Evaluator')}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="Worker">Worker (Provider)</option>
              <option value="Buyer">Buyer (Task Funder)</option>
              <option value="Evaluator">Evaluator (Verifier)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="agent-address"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Wallet Address (0x...)
            </label>
            <input
              id="agent-address"
              type="text"
              required
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {txHash && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success font-mono truncate">
              Tx: {txHash}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Registering &amp; Minting NFT...
              </>
            ) : (
              <>
                <UserCheck className="size-4" />
                Register &amp; Mint NFT
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
