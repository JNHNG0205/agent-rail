// Display names for the demo agents.
//
// IdentityRegistry.registerAgent(address) mints an identity token but stores
// no name — the earlier interface took one and the implementation dropped it.
// So a name cannot be read from the chain or an event, and the indexer has
// nothing to populate agents.name with.
//
// These are the three well-known Hardhat accounts the demo seeds, so a static
// map is honest and costs no gas. On a network where agents are not the seeded
// accounts, agentLabel() falls back to a truncated address.

export const AGENT_LABELS: Record<string, string> = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": "Agent A (client)",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "Agent B (provider)",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": "Agent C (evaluator)",
};

/// Display name for an agent address, falling back to a truncated address.
export function agentLabel(address: string): string {
  const key = address.toLowerCase();
  return AGENT_LABELS[key] ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}
