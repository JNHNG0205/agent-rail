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
  // Hardhat accounts #0–#2, used on the local chain.
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": "Agent A (client)",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "Agent B (provider)",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": "Agent C (evaluator)",
  // Base Sepolia. Different keypairs by necessity — the Hardhat keys above are
  // published, so funding them on a public chain loses the funds immediately.
  "0xb53a6b981f553805d3744e230f6a5668dea2b924": "Agent A (client)",
  "0xbe88cfe6027a2ed82c9e555c19cc40a0bd0942c8": "Agent B (provider)",
  "0x9031059af8d2141a811f5dabcf28ccce89f34863": "Agent C (evaluator)",
};

/// Display name for an agent address, falling back to a truncated address.
export function agentLabel(address: string): string {
  const key = address.toLowerCase();
  return AGENT_LABELS[key] ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}
