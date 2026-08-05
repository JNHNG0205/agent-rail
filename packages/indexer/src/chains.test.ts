import { test } from "node:test";
import assert from "node:assert/strict";
import { selectChain, type ChainCandidate } from "./chains.js";

const LOCAL: ChainCandidate = {
  name: "local",
  id: 31337,
  rpc: "http://127.0.0.1:8545",
  disableCache: true,
};
const TESTNET: ChainCandidate = {
  name: "baseSepolia",
  id: 84532,
  rpc: "https://rpc.test",
  disableCache: false,
};
const CANDIDATES = [LOCAL, TESTNET] as const;
const allDeployed = () => true;

test("follows the chain the rest of the stack is on", () => {
  assert.equal(selectChain({ candidates: CANDIDATES, chainId: 84532, isDeployed: allDeployed }).name, "baseSepolia");
  assert.equal(selectChain({ candidates: CANDIDATES, chainId: 31337, isDeployed: allDeployed }).name, "local");
});

test("returns exactly one chain, never several", () => {
  // The bug this exists to prevent: indexing every deployed chain at once. `job`
  // is keyed by jobId alone, so local job 0 and testnet job 0 are one row and
  // whichever syncs last wins. It is data corruption, not a display problem.
  const chosen = selectChain({ candidates: CANDIDATES, chainId: 31337, isDeployed: allDeployed });
  assert.equal(chosen.id, 31337);
  assert.notEqual(chosen.id, 84532);
});

test("refuses a chain with no deployment", () => {
  // A recorded zero address would index nothing at all, silently.
  assert.throws(
    () => selectChain({ candidates: CANDIDATES, chainId: 84532, isDeployed: (id) => id !== 84532 }),
    /No AgentRail deployment/,
  );
});

test("names the chain it could not find", () => {
  assert.throws(
    () =>
      selectChain({
        candidates: CANDIDATES,
        chainId: 84532,
        isDeployed: () => false,
        chainName: () => "Base Sepolia",
      }),
    /Base Sepolia \(CHAIN_ID=84532\)/,
  );
});

test("distinguishes an unknown chain from an undeployed one", () => {
  // Different faults, different fixes: one is a typo in CHAIN_ID, the other
  // means run the deploy script.
  assert.throws(
    () => selectChain({ candidates: CANDIDATES, chainId: 1, isDeployed: allDeployed }),
    /not a chain this indexer knows about/,
  );
});

test("carries the candidate's own settings through", () => {
  // Local disables Ponder's RPC cache because that chain restarts from genesis
  // and the cache assumes an immutable history.
  assert.equal(selectChain({ candidates: CANDIDATES, chainId: 31337, isDeployed: allDeployed }).disableCache, true);
  assert.equal(selectChain({ candidates: CANDIDATES, chainId: 84532, isDeployed: allDeployed }).disableCache, false);
});
