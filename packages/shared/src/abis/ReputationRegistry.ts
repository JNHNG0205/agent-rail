// Minimal hand-written fragments matching ReputationRegistry.sol.
// TODO(M2): regenerate the full ABI from artifacts after `npm run compile`.
export const ReputationRegistryAbi = [
  {
    type: "event",
    name: "ReputationUpdated",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "newScore", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "reputation",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "increment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "delta", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
