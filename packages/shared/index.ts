// @agentrail/shared — the ONLY bridge between contracts and their consumers.
// No package imports from `contracts` directly; import from here instead.
//
// Re-exports are listed explicitly (not `export *`) so tsx's per-file CJS
// transform leaves a statically analyzable export list — otherwise Node's
// ESM loader (via cjs-module-lexer) can't see named exports re-exported
// through this file and every named import from "@agentrail/shared" fails
// at runtime with "does not provide an export named ...".
export { JobState, JOB_STATE_LABELS, JOB_STATE_BY_LABEL, toJob } from "./src/types";
export type {
  Agent,
  Job,
  JobRow,
  JobStateLabel,
  JobOutcome,
  ContractAddresses,
  ContractName,
  PosterBrief,
  DeliverableReview,
  ChainEvent,
} from "./src/types";
export {
  LOCAL_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  LOCAL_RPC_URL,
  CHAIN_META,
  CHAIN_ID,
  RPC_URL,
  CHAIN_NAME,
  USDC_DECIMALS,
  JOB_TIMEOUT_BLOCKS,
  formatUsdc,
} from "./src/constants";
export {
  ZERO_ADDRESS,
  isDeployed,
  getAddresses,
  addresses,
  deployments,
  deploymentBlocks,
} from "./src/addresses";
export { JobContractAbi } from "./src/abis/JobContract";
export { EvaluatorModuleAbi } from "./src/abis/EvaluatorModule";
export { IdentityRegistryAbi } from "./src/abis/IdentityRegistry";
export { ReputationRegistryAbi } from "./src/abis/ReputationRegistry";
export { MockUSDCAbi } from "./src/abis/MockUSDC";
export { AGENT_LABELS, agentLabel } from "./src/agents";
