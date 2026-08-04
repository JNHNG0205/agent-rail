export type JobStep = 'Open' | 'Funded' | 'Submitted' | 'Terminal'

export const JOB_STEPS: JobStep[] = ['Open', 'Funded', 'Submitted', 'Terminal']

export type Agent = {
  label: string
  role: 'Buyer' | 'Worker'
  identityTokenId: string
  reputation: number
  reputationJobs: number
  address: string
  usdcBalance: number
}

export type ActivityEvent = {
  id: string
  type: 'JobCreated' | 'EscrowFunded' | 'WorkSubmitted' | 'JobCompleted'
  description: string
  txHash: string
  timeAgo: string
  block: number
}

export const AGENTS: Agent[] = [
  {
    label: 'Agent A',
    role: 'Buyer',
    identityTokenId: '8004-0417',
    reputation: 94.2,
    reputationJobs: 218,
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    usdcBalance: 48250.75,
  },
  {
    label: 'Agent B',
    role: 'Worker',
    identityTokenId: '8004-1192',
    reputation: 98.6,
    reputationJobs: 512,
    address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    usdcBalance: 12980.4,
  },
]

export const ACTIVE_JOB = {
  jobId: 'JOB-31337-0x0a4c',
  currentStep: 'Submitted' as JobStep,
  escrowAmount: 5000,
  deliverableHash:
    '0x9f2c8d4e7a1b6035f8c2e9d1a4b7c60358e1f2d9a8b7c6e5d4f3a2b1c09876543',
  signature:
    '0xf3a9c2e8b7d6a5f4c3b2a1908f7e6d5c4b3a2918f7e6d5c4b3a29187f6e5d4c31b2a19087f6e5d4c3b2a19087f6e5d4c3b2a19087f6e5d4c3b2a19087f6e5d4c31c',
  createdAt: '4 hours ago',
  buyer: 'Agent A',
  worker: 'Agent B',
}

export const EVENTS: ActivityEvent[] = [
  {
    id: 'e1',
    type: 'WorkSubmitted',
    description: 'Agent B submitted deliverable for JOB-31337-0x0a4c',
    txHash: '0x8c1f2a9d7e6b5c4a3f2e1d0c9b8a7f6e5d4c3b2a1908f7e6d5c4b3a29187f6e5d',
    timeAgo: '2m ago',
    block: 184_213,
  },
  {
    id: 'e2',
    type: 'EscrowFunded',
    description: '5,000 USDC locked in escrow by Agent A',
    txHash: '0x3b2a1908f7e6d5c4b3a29187f6e5d4c8c1f2a9d7e6b5c4a3f2e1d0c9b8a7f6e5d',
    timeAgo: '1h ago',
    block: 184_002,
  },
  {
    id: 'e3',
    type: 'JobCreated',
    description: 'JOB-31337-0x0a4c opened with ERC-8183 escrow terms',
    txHash: '0x1d0c9b8a7f6e5d4c3b2a19087f6e5d4c8c1f2a9d7e6b5c4a3f2e1d0c9b8a7f6e5',
    timeAgo: '4h ago',
    block: 183_640,
  },
  {
    id: 'e4',
    type: 'JobCompleted',
    description: 'JOB-31337-0x09f1 settled — 3,200 USDC released to Agent B',
    txHash: '0x7f6e5d4c3b2a19087f6e5d4c8c1f2a9d7e6b5c4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    timeAgo: '6h ago',
    block: 182_998,
  },
]

export const METRICS = {
  totalEscrowed: 42_180,
  activeJobs: 7,
}

export const CONNECTED_WALLET = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
}

export type RegisteredAgent = {
  tokenId: string
  name: string
  role: 'Buyer' | 'Worker' | 'Evaluator'
  address: string
  reputation: number
  completedJobs: number
  ratingAverage: number
  attestations: number
  specialty: string
}

export const REGISTERED_AGENTS: RegisteredAgent[] = [
  {
    tokenId: '8004-0417',
    name: 'Agent A',
    role: 'Buyer',
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    reputation: 94.2,
    completedJobs: 218,
    ratingAverage: 4.7,
    attestations: 342,
    specialty: 'Procurement Orchestration',
  },
  {
    tokenId: '8004-1192',
    name: 'Agent B',
    role: 'Worker',
    address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    reputation: 98.6,
    completedJobs: 512,
    ratingAverage: 4.9,
    attestations: 806,
    specialty: 'Data Labeling & QA',
  },
  {
    tokenId: '8004-2048',
    name: 'Nyx Solver',
    role: 'Worker',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    reputation: 91.3,
    completedJobs: 147,
    ratingAverage: 4.5,
    attestations: 201,
    specialty: 'Optimization Search',
  },
  {
    tokenId: '8004-3311',
    name: 'Oracle Prime',
    role: 'Evaluator',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    reputation: 99.1,
    completedJobs: 890,
    ratingAverage: 5.0,
    attestations: 1420,
    specialty: 'ECDSA Verification',
  },
  {
    tokenId: '8004-4090',
    name: 'Vault Keeper',
    role: 'Buyer',
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    reputation: 88.7,
    completedJobs: 63,
    ratingAverage: 4.3,
    attestations: 98,
    specialty: 'Treasury Automation',
  },
  {
    tokenId: '8004-5127',
    name: 'Mesh Weaver',
    role: 'Worker',
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    reputation: 95.8,
    completedJobs: 305,
    ratingAverage: 4.8,
    attestations: 512,
    specialty: 'Multi-Agent Coordination',
  },
]

export type Job = {
  id: string
  buyer: string
  worker: string
  amount: number
  status: JobStep
  deliverableHash: string
  createdAt: string
  block: number
}

export const JOBS: Job[] = [
  {
    id: 'JOB-31337-0x0a4c',
    buyer: 'Agent A',
    worker: 'Agent B',
    amount: 5000,
    status: 'Submitted',
    deliverableHash:
      '0x9f2c8d4e7a1b6035f8c2e9d1a4b7c60358e1f2d9a8b7c6e5d4f3a2b1c09876543',
    createdAt: '4h ago',
    block: 183_640,
  },
  {
    id: 'JOB-31337-0x0b71',
    buyer: 'Vault Keeper',
    worker: 'Nyx Solver',
    amount: 1200,
    status: 'Funded',
    deliverableHash:
      '0x4a1b6035f8c2e9d1a4b7c60358e1f2d9a8b7c6e5d4f3a2b1c098765439f2c8d4e',
    createdAt: '9h ago',
    block: 183_120,
  },
  {
    id: 'JOB-31337-0x0c93',
    buyer: 'Agent A',
    worker: 'Mesh Weaver',
    amount: 8750,
    status: 'Open',
    deliverableHash:
      '0xd4f3a2b1c098765439f2c8d4e7a1b6035f8c2e9d1a4b7c60358e1f2d9a8b7c6e5',
    createdAt: '11h ago',
    block: 182_998,
  },
  {
    id: 'JOB-31337-0x09f1',
    buyer: 'Vault Keeper',
    worker: 'Agent B',
    amount: 3200,
    status: 'Terminal',
    deliverableHash:
      '0x358e1f2d9a8b7c6e5d4f3a2b1c098765439f2c8d4e7a1b6035f8c2e9d1a4b7c60',
    createdAt: '6h ago',
    block: 182_998,
  },
  {
    id: 'JOB-31337-0x08a2',
    buyer: 'Agent A',
    worker: 'Nyx Solver',
    amount: 640,
    status: 'Terminal',
    deliverableHash:
      '0xb7c60358e1f2d9a8b7c6e5d4f3a2b1c098765439f2c8d4e7a1b6035f8c2e9d1a4',
    createdAt: '1d ago',
    block: 181_402,
  },
  {
    id: 'JOB-31337-0x07c5',
    buyer: 'Vault Keeper',
    worker: 'Mesh Weaver',
    amount: 15000,
    status: 'Funded',
    deliverableHash:
      '0x2b1c098765439f2c8d4e7a1b6035f8c2e9d1a4b7c60358e1f2d9a8b7c6e5d4f3a',
    createdAt: '1d ago',
    block: 181_050,
  },
]

/** Minimal, deterministic keccak256-style hash for the evaluator playground demo. */
export function pseudoKeccak(input: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ ((c << 3) | i), 0x85ebca6b) >>> 0
  }
  let hex = ''
  let a = h1
  let b = h2
  for (let i = 0; i < 8; i++) {
    a = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) >>> 0
    b = Math.imul(b ^ (b >>> 13), 0x297a2d39) >>> 0
    hex += (a ^ b).toString(16).padStart(8, '0')
  }
  return '0x' + hex.slice(0, 64)
}

export function truncateHex(value: string, start = 6, end = 4) {
  if (value.length <= start + end) return value
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function formatUsdc(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
