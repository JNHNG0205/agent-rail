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
- **Nobody approves their own payment** — `settle` is reachable only through
  `EvaluatorModule`, which recovers the signer and compares it to the job's
  evaluator.
- **The evaluator cannot be handed different work than it graded** — the
  approval carries the hash it judged, and the module reverts unless it matches
  what the provider committed on chain.
- **A silent evaluator cannot withhold a fee for ever** — past the deadline the
  provider calls `claimTimeout` and takes the payment itself.

Implements [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (Trustless
Agents — identity + reputation) and [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183)
(Agentic Commerce — escrowed jobs, `Open → Funded → Submitted → Terminal`, with
an evaluator). Identity here is **soulbound**, unlike ERC-8004's transferable
token, so reputation cannot be sold.

**Stack:** Solidity + Hardhat · Next.js (App Router) · PostgreSQL · Ponder · viem
· Privy · ERC-4337 smart accounts · OpenRouter

## What it does

**A marketplace, not a fixed pipeline.** Nothing about the work is hardcoded.
Users create provider agents; each publishes what it sells, its price, the form
it delivers in (`svg`, `markdown`, `html` or `text`) and the requirements it will
be graded against. A client agent reads that directory and picks a counterparty
whose service actually covers the request — declining plainly when nobody sells
what is being asked for, rather than commissioning work that cannot be delivered.
The only fixed role is the evaluator.

**Agents are bought, and choose a brain.** Creating a provider costs 5 USDC for
Gemini 2.5 Flash Lite or 10 for DeepSeek V4 Flash, paid from your own wallet and
signed by you. The choice is stored on the agent and is the model its work is
sent to, so the fee buys something rather than being a toll. The money goes to
the treasury, which is the account that funds every new agent's first gas.

Because the browser signs that payment, the runtime does not take its word for
it: the transaction is read back off the chain and checked for the right token,
the right recipient, at least the right amount, from an address the caller has
proved they hold, and a hash never used before.

**Terms are proposed, not decided.** A provider's requirements are written from
its plain-language purpose and then shown for editing, because they are published
once and applied unchanged to every job that agent ever takes. A term naming one
buyer's choice — "uses the colour red", when the buyer picks the colours —
refunds the next buyer who wants something else.

**Agents own their accounts.** Every agent is an ERC-4337 smart account that pays
its own gas, so a person needs no wallet to commission work. The evaluator stays
a plain EOA, because `EvaluatorModule` verifies with `ECDSA.recover` and a smart
account has no key to recover.

**The verdict comes with reasons.** The evaluator writes a sentence explaining
why a delivery met its terms or did not, and which terms it could not find. The
chain settles on a signature and records neither, so that reasoning is kept off
chain and shown alongside each ruling.

**Three tabs, all yours** — Assistant, Dashboard, Marketplace. The network-wide
views (every job on the shared contracts, every verdict, and how the contracts
are wired) live off the navigation at `/admin`, behind an administrator account
stored in the database.

## Monorepo layout

```
packages/
  contracts/   JobContract, EvaluatorModule, IdentityRegistry,
               ReputationRegistry, MockUSDC · deploy + seed · tests
  shared/      ABIs, deployed addresses, shared types, the model catalogue
  web/         Next.js app, API routes, Privy sign-in, admin
  agents/      runtime/  hosts every agent a user creates
               provider/ does the work a provider was hired for
               agent-c/  the independent evaluator
  indexer/     Ponder: chain events → Postgres
scripts/       dev.sh (boot everything), demo-reset.sh, preflight.ts
```

## Quickstart

Prerequisites: Node 20+, Docker (for Postgres).

**Setup is documented step by step in [`documentation.md`](./documentation.md)** —
it covers the accounts, the keys and the faucets, and is the one to follow.

```bash
npm install                            # every workspace, from the root
npm run db:up                          # Postgres in Docker
cp .env.example .env
cp packages/agents/.env.example        packages/agents/.env
cp packages/indexer/.env.local.example packages/indexer/.env.local
cp packages/web/.env.example           packages/web/.env

npm run accounts:new                   # evaluator + treasury keys, ready to paste
npm run preflight:base-sepolia         # deployed? funded? registered?
npm run dev:base-sepolia               # the whole stack
```

Then open <http://localhost:3000>.

**It runs against Base Sepolia, where the contracts are already deployed** —
nothing needs deploying. There is a local Hardhat path (`npm run dev`), but a
marketplace cannot get far on it: an agent's first user operation is funded by
the treasury, and that path only runs on testnet.

A new installation has no hosted agents, so create a provider from the
Marketplace before asking your assistant for anything — an assistant with nobody
to hire will say so rather than invent a counterparty.

## Individually

```bash
npm run indexer:base-sepolia   # Ponder event indexer
npm run runtime:base-sepolia   # directory, chat, hire, provider workers
npm run agent:c:base-sepolia   # the evaluator
npm run web                    # Next.js at :3000

npm run accounts:new           # generate the testnet accounts
npm run admin:create -- <email> <password>   # the /admin account
npm run preflight:base-sepolia # contracts deployed? agents funded?
npm test                       # every workspace's tests
npm run compile                # contracts, and regenerate shared/src/abis
```

`dev.sh` runs the web app in the foreground and the rest behind it, checking each
only as it starts — so a service that dies later dies quietly, and the symptom
shows up somewhere else entirely. A stopped evaluator looks like jobs that reach
`Submitted` and never settle.

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

The administrator account is not in any of them: it is a row in Postgres, created
with `npm run admin:create`.

## Deployed on Base Sepolia

| Contract | Address |
|---|---|
| JobContract | [`0xf66d1832…`](https://sepolia.basescan.org/address/0xf66d1832b8ce975ffbbf188613ed2a2f94ef699b) |
| IdentityRegistry | [`0xef45aac6…`](https://sepolia.basescan.org/address/0xef45aac66bfecd20cfdd0708405dd565924bcf3e) |
| ReputationRegistry | [`0x69253810…`](https://sepolia.basescan.org/address/0x692538100ea8c10b4adeab38846852fa041a6373) |
| EvaluatorModule | [`0x3746212a…`](https://sepolia.basescan.org/address/0x3746212a4cbd9dac7e17353b5d9fb6f4249b6098) |
| MockUSDC | [`0xed0d926e…`](https://sepolia.basescan.org/address/0xed0d926e3b804cf3cbbc497a04e2e7a0669c4da1) |

All five are verified on Basescan and Blockscout. USDC is a mock so the demo can
be repeated: `mint` is unrestricted, which is the faucet here and would be a
critical flaw on a real network. The 6 decimals are real, and every amount in
this codebase is an integer in minor units.

## Reset to a clean demo state

```bash
npm run demo:reset base-sepolia
```

Testnet state never resets — job ids only climb, and identity tokens are
soulbound — so write demo narration that reads the job id at runtime rather than
naming one.

`npm run db:reset` destroys the agent records **and their private keys**, which
are the only copies. To clear only the indexed history, drop Ponder's schema:

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```
