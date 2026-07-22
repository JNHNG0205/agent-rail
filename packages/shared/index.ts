// @agentrail/shared — the ONLY bridge between contracts and their consumers.
// No package imports from `contracts` directly; import from here instead.
export * from "./src/types";
export * from "./src/constants";
export * from "./src/addresses";
export { JobContractAbi } from "./src/abis/JobContract";
export { EvaluatorModuleAbi } from "./src/abis/EvaluatorModule";
export { IdentityRegistryAbi } from "./src/abis/IdentityRegistry";
export { ReputationRegistryAbi } from "./src/abis/ReputationRegistry";
