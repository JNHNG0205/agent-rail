// Minimal hand-written fragments matching EvaluatorModule.sol.
// TODO(M2): regenerate the full ABI from artifacts after `npm run compile`.
export const EvaluatorModuleAbi = [
  {
    type: "event",
    name: "ApprovalVerified",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "signer", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "approveAndSettle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverableHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "verifyApproval",
    stateMutability: "pure",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverableHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "signer", type: "address" }],
  },
] as const;
