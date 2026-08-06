# AgentRail

Decentralised AI agent payment settlement DApp — **CT124-3-3 Group 7**.

A person signs in, describes what they want, and **their own AI agent hires a
different person's AI agent** to make it. Payment is escrowed on chain before any
work begins, and a third, independent agent grades the result against terms the
seller published in advance — releasing the payment or refunding it.

The separation is the point. A client never grades its own job, so "pay only for
work that meets the terms" is enforced rather than promised:

- The seller's terms are **published before hiring**, so what is judged cannot
  drift from what was advertised.
- **Nobody approves their own payment** — `EvaluatorModule` recovers the signer
  and compares it to the job's evaluator.
- **A silent evaluator cannot withhold a fee for ever** — past the deadline the
  provider calls `claimTimeout` and takes the payment itself.

Agents are not hardcoded. Users create them: a provider publishes what it sells,
its price, the form it delivers in (`svg`, `markdown` or `text`) and the
requirements it will be graded against. The only fixed role is the evaluator.

Implements [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (Trustless
Agents — identity + reputation) and [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183)
(Agentic Commerce — escrowed jobs, `Open → Funded → Submitted → Terminal`, with
an evaluator). Identity here is **soulbound**, unlike ERC-8004's transferable
token, so reputation cannot be sold.

**Stack:** Solidity + Hardhat · Next.js (App Router) · PostgreSQL · Ponder · viem
· Privy · ERC-4337 smart accounts

## Monorepo layout

```
packages/
  contracts/   JobContract, EvaluatorModule, IdentityRegistry,
               ReputationRegistry, MockUSDC · deploy + seed · tests
  shared/      ABIs, deployed addresses, shared types + constants
  web/         Next.js app, API routes, Privy sign-in
  agents/      runtime/  hosts every agent a user creates
               provider/ does the work a provider was hired for
               agent-c/  the independent evaluator
  indexer/     Ponder: chain events → Postgres
scripts/       dev.sh (boot everything), demo-reset.sh, preflight.ts
```

Full design, and the reasoning behind it, in
[`agentrail-architecture.md`](./agentrail-architecture.md).

## Quickstart

Prerequisites: Node 20+, Docker (for Postgres).

```bash
npm install                       # installs every workspace
cp .env.example .env              # only needed for Base Sepolia
cp packages/agents/.env.example        packages/agents/.env
cp packages/indexer/.env.local.example packages/indexer/.env.local
cp packages/web/.env.example           packages/web/.env

npm run db:up                     # Postgres in Docker
npm run dev                       # everything, on a local chain
```

`npm run dev` starts Postgres, a Hardhat node, deploys, seeds, then runs the
indexer, the agent runtime, the evaluator and the web app. Ctrl-C stops all of
it. Open <http://localhost:3000> and talk to your assistant.

No API keys are needed to run locally — `LLM_PROVIDER=mock` makes a fresh clone
work offline, and the schema is created for you (Ponder owns its own tables).

### Against the deployed testnet

```bash
npm run dev:base-sepolia
```

Checks the deployed contracts, registrations and balances first and refuses to
start if anything is wrong. Needs `BASE_SEPOLIA_RPC_URL` and the testnet keys in
`.env` and `packages/agents/.env`.

## Individually

```bash
npm run chain          # local Hardhat node at :8545
npm run deploy         # deploy, and write shared/src/deployments.ts
npm run seed           # register the seed agents, mint MockUSDC
npm run indexer        # Ponder event indexer
npm run runtime        # agent runtime: directory, chat, hire, provider workers
npm run agent:c        # the evaluator
npm run web            # Next.js at :3000
npm test               # every workspace's tests
npm run compile        # contracts, and regenerate shared/src/abis
```

Each has a `:base-sepolia` variant that sets `CHAIN_ID`. An agent started by hand
reads `packages/agents/.env`, so use the matching variant or it talks to the
wrong chain — and the failure looks like a chain problem rather than the wrong
chain.

## Environment files

Each package reads one file, and only its own. A value set in the wrong file is
ignored, which looks exactly like it having no effect.

| File | Read by |
|---|---|
| `.env` | Hardhat (deploy, seed, verify) and `scripts/preflight.ts` |
| `packages/agents/.env` | the agent runtime and the evaluator |
| `packages/indexer/.env.local` | Ponder — it does not read `.env` |
| `packages/web/.env` | Next.js |

`NEXT_PUBLIC_*` is inlined into the browser bundle, so those hold **public
endpoints only** — a private RPC URL there publishes its key to every visitor.

## Deployed on Base Sepolia

| Contract | Address |
|---|---|
| JobContract | [`0xf66d1832…`](https://sepolia.basescan.org/address/0xf66d1832b8ce975ffbbf188613ed2a2f94ef699b) |
| IdentityRegistry | [`0xef45aac6…`](https://sepolia.basescan.org/address/0xef45aac66bfecd20cfdd0708405dd565924bcf3e) |
| ReputationRegistry | [`0x69253810…`](https://sepolia.basescan.org/address/0x692538100ea8c10b4adeab38846852fa041a6373) |
| EvaluatorModule | [`0x3746212a…`](https://sepolia.basescan.org/address/0x3746212a4cbd9dac7e17353b5d9fb6f4249b6098) |
| MockUSDC | [`0xed0d926e…`](https://sepolia.basescan.org/address/0xed0d926e3b804cf3cbbc497a04e2e7a0669c4da1) |

All five are verified on Basescan and Blockscout.

## Reset to a clean demo state

```bash
npm run demo:reset            # add `base-sepolia` for the testnet
```

Testnet state never resets — job ids only climb, and identity tokens are
soulbound — so write demo narration that reads the job id at runtime rather than
naming one.
