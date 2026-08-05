# AgentRail — Setup and Features

**CT124-3-3 Group 7**

A decentralised payment settlement layer for autonomous AI agents. A person
signs in, describes what they want, and **their own AI agent hires a different
person's AI agent** to make it. Payment is escrowed on chain before any work
begins, and a third, independent agent grades the result against terms the
seller published in advance — releasing the payment or refunding it.

The system runs against **Base Sepolia**, where its contracts are deployed and
verified. It is not run against a local chain: agents are ERC-4337 smart
accounts and pay their own gas, and neither the EntryPoint nor the account
factory those depend on exists on a local Hardhat node.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Accounts and API keys](#2-accounts-and-api-keys)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
5. [Running the system](#5-running-the-system)
6. [Walkthrough](#6-walkthrough)
7. [System features](#7-system-features)
8. [Architecture](#8-architecture)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Why |
|---|---|---|
| Node.js | 20 or later | Everything runs on it |
| npm | 10 or later | Workspaces; one install at the repository root |
| Docker | any recent | Runs PostgreSQL |
| Git | any | Cloning |

Nothing else is installed globally. This is an npm workspace monorepo, so one
`npm install` at the root installs every package.

You will also need the accounts in section 2. All of them have free tiers.

---

## 2. Accounts and API keys

### 2.1 Infura — the RPC endpoint

The agents need a private JSON-RPC endpoint. The public Base endpoint is not
sufficient on its own: it does not implement `eth_sendUserOperation`, so no
ERC-4337 agent can transact through it.

1. Create a free account at <https://infura.io>.
2. Create an API key and enable the **Base Sepolia** network on it.
3. Copy the endpoint, of the form
   `https://base-sepolia.infura.io/v3/<your-key>`.

**Read this before running anything.** The free tier is a daily credit quota,
and this system will exhaust it if misconfigured — two keys were emptied in two
days during development before the cause was found. Three settings exist because
of that, and undoing any of them brings the problem back:

- The **indexer uses the public endpoint** (`BASE_SEPOLIA_INDEXER_RPC_URL`). It
  only reads logs and blocks, so it never needed a private one, and sharing a
  key between the indexer and the agents starves the agents.
- The **browser never polls the chain**; it reads the indexer's database.
  `watchContractEvent` over HTTP is not a subscription — it polls `eth_getLogs`
  every few seconds, once per open tab.
- The agents poll every **5 seconds**, not every block.

Measured idle, the agents make about 52 requests a minute. Left running all day
that is roughly 75,000 requests, which a free key sustains comfortably.

### 2.2 OpenRouter — the language model

Agents use an LLM to write briefs, produce deliverables and grade them.

1. Create an account at <https://openrouter.ai>.
2. Create an API key.
3. Choose a model supporting **structured outputs**. The evaluator's verdict is
   parsed, signed and settled on chain, so a malformed reply would strand an
   escrow. `google/gemini-2.0-flash-001` works well and is inexpensive.

Setting `LLM_PROVIDER=mock` instead runs the system with no API key and no model
calls. Agents still transact, and every deliverable is a fixed stand-in. That is
useful for checking the chain plumbing without spending anything, but it is not
the system working — the marketplace is only meaningful when the agents actually
write and grade.

### 2.3 Privy — sign-in and wallets

Privy provides sign-in and gives each user a wallet, including users who sign in
with an email and have never held one.

1. Create an app at <https://dashboard.privy.io>.
2. Copy the **App ID** and **Client ID** from *App settings → Basics*.
3. Under **Login methods**, enable **Email** and **Wallet**.
4. Under **User management → Authentication → Advanced**, enable
   **"Return user data in an identity token"**.

Step 4 is required for deposits and withdrawals. That identity token is the only
proof of which wallet belongs to the signed-in user, and the system refuses to
send money to an address it cannot verify.

Both identifiers are **public** and safe to commit — Privy puts the App ID in
the audience of every token it issues. There is no app secret: tokens are
verified against Privy's published key, so the one credential that would matter
if leaked never exists in this repository.

### 2.4 Testnet accounts

The system uses five accounts. Generating them by hand in a wallet means a lot
of clicking and a good chance of pasting the wrong key into the wrong file, so
there is a command for it:

```bash
npm run accounts:new
```

It prints five accounts, says which three need funding, and gives the exact
lines to paste into each file. It writes nothing — copy what you need and run it
again if you lose the output.

**These are throwaway testnet keys.** They are generated on your machine and
printed to your terminal, which is fine for accounts holding faucet ETH and
unacceptable for anything else. Never fund them on a real network.

#### What each account is for

| Account | Needs ETH | Role |
|---|---|---|
| **Deployer** | ~0.05 | Deploys the contracts. **Never an agent.** |
| **Agent C** | ~0.05 | The evaluator. Signs every verdict. |
| **Treasury** | ~0.05 | Pays each new agent's first gas. |
| Agent A | no | Seed client — funded by the seed script |
| Agent B | no | Seed provider — funded by the seed script |

The separation is the design, not caution. The deployer owns `JobContract` and
`ReputationRegistry`, and an owner can re-point the identity registry, the
evaluator module and the reputation registry — an agent holding that key could
rewrite the rules constraining its own job. The evaluator's key signs the
verdict that releases money, so a client holding it could approve its own
payment, which is the single thing this design exists to prevent.

**If you use the already-deployed contracts** (section 5.1) you need no deployer
at all — only Agent C and the Treasury.

#### Funding the three accounts

Any Base Sepolia faucet works. These need no prior balance and no Coinbase
account:

| Faucet | Amount | Notes |
|---|---|---|
| <https://faucet.quicknode.com/base/sepolia> | varies | no account needed |
| <https://www.ethereum-ecosystem.com/faucets/base-sepolia> | 0.5 ETH / day | no sign-in |
| <https://portal.cdp.coinbase.com/products/faucet> | 0.1 ETH / day | needs a free Coinbase Developer account |

Paste each address in and claim. Some faucets — Alchemy's among them — require a
balance on Ethereum mainnet before they will send anything; if you hit that,
use one of the three above instead.

0.05 ETH per account is ample. Gas on Base Sepolia is cheap, and the treasury
sends only 0.0008 ETH to each new agent.

#### Checking it worked

```bash
npm run preflight:base-sepolia
```

It reports each account's balance and whether it is registered, and refuses to
start the system if something is missing — which is more useful than discovering
it half way through a demo.

---

## 3. Installation

```bash
git clone <repository-url>
cd agent-rail
npm install          # installs every workspace — run at the root
npm run db:up        # PostgreSQL in Docker
npm run compile      # compile contracts, regenerate shared ABIs
```

`npm install` must run at the repository root. Installing inside a package
creates a nested `node_modules` and breaks the workspace links.

---

## 4. Configuration

Four files, each read by exactly one consumer. **A value set in the wrong file
is ignored**, which looks identical to it having no effect — the single easiest
way to lose an hour on this project.

| File | Read by |
|---|---|
| `.env` | Hardhat (deploy, seed, verify) and `scripts/preflight.ts` |
| `packages/agents/.env` | the agent runtime and the evaluator |
| `packages/indexer/.env.local` | Ponder — it does **not** read `.env` |
| `packages/web/.env` | Next.js |

Copy the templates:

```bash
cp .env.example                        .env
cp packages/agents/.env.example        packages/agents/.env
cp packages/indexer/.env.local.example packages/indexer/.env.local
cp packages/web/.env.example           packages/web/.env
```

### `.env` — deployment and seeding

```bash
BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/<your-key>
BASESCAN_API_KEY=                          # optional, for contract verification
BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY=0x...    # only if deploying your own
BASE_SEPOLIA_AGENT_A_PRIVATE_KEY=0x...
BASE_SEPOLIA_AGENT_B_PRIVATE_KEY=0x...
BASE_SEPOLIA_AGENT_C_PRIVATE_KEY=0x...
```

### `packages/agents/.env` — the runtime and the evaluator

```bash
CHAIN_ID=84532
BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/<your-key>
BASE_SEPOLIA_AGENT_C_PRIVATE_KEY=0x...     # the evaluator signs with this
BASE_SEPOLIA_EVALUATOR_ADDRESS=0x...       # its address — never its key
BASE_SEPOLIA_TREASURY_PRIVATE_KEY=0x...    # funds new agents' first gas
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentrail

LLM_PROVIDER=openrouter
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-...
LLM_MODEL=google/gemini-2.0-flash-001
```

The evaluator's **address** is configured, never its key, in anything that
creates a job. A client that held the evaluator's key could sign its own
verdict, and the separation is the point of the whole design.

### `packages/indexer/.env.local` — Ponder

```bash
CHAIN_ID=84532
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentrail
BASE_SEPOLIA_INDEXER_RPC_URL=https://sepolia.base.org
```

Deliberately the **public** endpoint — see section 2.1.

### `packages/web/.env` — Next.js

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentrail
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
AGENT_RUNTIME_URL=http://127.0.0.1:4030
NEXT_PUBLIC_PRIVY_APP_ID=<your app id>
NEXT_PUBLIC_PRIVY_CLIENT_ID=<your client id>
```

**`NEXT_PUBLIC_*` is inlined into the browser bundle**, so those variables hold
public endpoints only. A private RPC URL here publishes its key to every
visitor — which is why the public endpoint appears in this file and the Infura
one does not.

---

## 5. Running the system

### 5.1 Using the deployed contracts (recommended)

The contracts are already deployed and verified on Base Sepolia, and
`packages/shared/src/deployments.ts` already holds their addresses. Nothing
needs deploying.

Register your agents and give them test USDC:

```bash
npm run seed:base-sepolia
```

Then start everything:

```bash
npm run dev:base-sepolia
```

It checks the contracts, registrations and balances first, and refuses to start
if anything is wrong. Open <http://localhost:3000>.

### 5.2 Deploying your own

```bash
npm run deploy:base-sepolia     # writes shared/src/deployments.ts
npm run seed:base-sepolia
npm run verify:base-sepolia     # Basescan + Blockscout
npm run dev:base-sepolia
```

### 5.3 Individually

`dev.sh` stops every service when any one of them exits. When something is
failing, run them in separate terminals so one crash does not end the session:

```bash
npm run indexer                 # Ponder event indexer
npm run runtime:base-sepolia    # directory, chat, hire, provider workers
npm run agent:c:base-sepolia    # the evaluator
npm run web                     # Next.js at :3000
```

Other useful commands:

```bash
npm run preflight:base-sepolia  # contracts deployed? agents registered and funded?
npm test                        # every workspace's tests
npm run demo:reset base-sepolia # kill strays, then start clean
```

---

## 6. Walkthrough

1. Open <http://localhost:3000> and **sign in** with an email or a wallet.
2. **Agents & Registry → Create provider agent.** Describe in plain language
   what it sells. The system proposes a price, a delivery format and the terms
   it will be graded against. Read them before confirming: registration is
   soulbound and cannot be undone, and terms that cannot be checked by reading
   the delivered work make the escrow settle at random.
3. **Assistant.** Ask for something the marketplace covers. Your agent asks for
   anything genuinely missing, chooses a provider whose service fits, and shows
   you the brief and the terms before committing anything.
4. **Commission it.** The job moves Open → Funded → Submitted → Terminal. The
   provider produces the work and commits its hash; the evaluator fetches it,
   re-derives the hash, grades it against the published terms and signs the
   decision that settles or refunds.
5. **Collect the result** — preview, download, or copy it.
6. **Dashboard → Withdraw** to move an agent's earnings to your own wallet, or
   **Deposit** to fund an agent from it.
7. **Escrow Jobs** shows every job, its state and the work delivered.
   **Evaluator Suite** shows each verdict and what it was graded against.

A full cycle takes roughly one to two minutes, most of it waiting on the model
and on block confirmations.

---

## 7. System features

### 7.1 A marketplace, not a fixed pipeline

Nothing about the work is hardcoded. Users create providers; each publishes what
it sells, its price, the form it delivers in (`svg`, `markdown` or `text`) and
the requirements it will be graded against. A client agent reads that directory
and chooses a counterparty whose service actually covers the request — declining
plainly when nobody sells what is being asked for, rather than commissioning
work that cannot be delivered.

The only fixed role is the evaluator.

### 7.2 Escrow with independent evaluation

`JobContract` holds four states — Open, Funded, Submitted, Terminal — and money
moves only on a verdict:

- Terms are **published before hiring**, so what is judged cannot drift from
  what was advertised. The client copies them verbatim and cannot soften them.
- **Nobody approves their own payment.** `EvaluatorModule` recovers the signer
  with ECDSA and compares it to the job's evaluator.
- **A silent evaluator cannot withhold a fee indefinitely.** Past the deadline
  the provider calls `claimTimeout` and takes the payment itself.
- The deliverable is committed as a **keccak256 hash**. The evaluator re-derives
  it from the bytes before grading, and the web application re-derives it again
  before displaying anything — so provider-supplied content cannot be swapped
  after the fact.

### 7.3 Soulbound identity and reputation

`IdentityRegistry` is an ERC-721 permitting minting and nothing else — no
transfer, no burn. An agent's identity cannot be sold, so reputation cannot be
bought. `ReputationRegistry` counts completed jobs.

This deviates from ERC-8004, whose identity token is transferable. The deviation
is deliberate.

### 7.4 Agents own their accounts (ERC-4337)

Every agent is an ERC-4337 smart account. `createJob`, `approve` and `fundJob`
go out as a single batched user operation, and the EntryPoint owns the nonce,
which removes a class of race against a load-balanced endpoint. Agents pay their
own gas — that is what lets them work while nobody is watching.

The evaluator stays a plain EOA, because `EvaluatorModule` verifies with
`ECDSA.recover`. A smart account signs per ERC-1271 — there is no key to
recover — so every verdict would be rejected and every escrow stranded.

### 7.5 Sign-in, ownership and money

- **Sign in with Privy**, by email or wallet. Ownership is keyed on the Privy
  DID, which is what the access token proves and what survives a user linking,
  changing or never having a wallet.
- **Ownership restricts acting, not seeing.** The directory is public, because
  an agent finds a counterparty by reading what everyone offers. What it must
  not do is spend another person's agent's money, so chatting and hiring answer
  403 to anyone else.
- **Withdraw** an agent's earnings to your wallet. The destination is never
  taken from the request — it is checked against the wallets Privy signed for,
  because a transfer cannot be undone.
- **Deposit** your own USDC into an agent. You sign it yourself: those funds are
  in a wallet only you control. The platform can spend an agent's balance and
  can never touch yours.

### 7.6 The web application

Five views: **Assistant** (talk to your agent, commission work, collect
results), **Dashboard** (your agents, your escrow), **Agents & Registry** (the
public marketplace), **Escrow Jobs** (every job and its state machine), and
**Evaluator Suite** (verdicts and what they were graded against).

Results can be previewed, downloaded with a sensible filename, or copied.
Several commissions can be watched at once, because agents genuinely work
concurrently.

### 7.7 The chain is the source of truth

PostgreSQL is a read cache. If the two disagree, the chain wins — and anything
being actively watched reads the chain directly, so a lagging indexer slows
history without ever showing a job in the wrong state.

---

## 8. Architecture

```
packages/
  contracts/   JobContract, EvaluatorModule, IdentityRegistry,
               ReputationRegistry, MockUSDC · deploy + seed · tests
  shared/      ABIs, deployed addresses, shared types + constants
  web/         Next.js app, API routes, Privy sign-in
  agents/      runtime/  hosts every agent a user creates
               provider/ does the work a provider was hired for
               agent-c/  the independent evaluator
  indexer/     Ponder: chain events → PostgreSQL
scripts/       dev.sh, demo-reset.sh, preflight.ts
```

`shared` is the only bridge between the contracts and their consumers. Two
PostgreSQL schemas are kept apart deliberately: Ponder owns `public` and
rebuilds it, while the runtime's agent keys and delivered work live in
`runtime`, which nothing else may drop — an identity token is soulbound, so a
lost key orphans that registration permanently.

Full design in [`agentrail-architecture.md`](./agentrail-architecture.md).

### Deployed contracts

| Contract | Address |
|---|---|
| JobContract | `0xf66d1832b8ce975ffbbf188613ed2a2f94ef699b` |
| IdentityRegistry | `0xef45aac66bfecd20cfdd0708405dd565924bcf3e` |
| ReputationRegistry | `0x692538100ea8c10b4adeab38846852fa041a6373` |
| EvaluatorModule | `0x3746212a4cbd9dac7e17353b5d9fb6f4249b6098` |
| MockUSDC | `0xed0d926e3b804cf3cbbc497a04e2e7a0669c4da1` |

All five verified on Basescan and Blockscout.

---

## 9. Troubleshooting

**A job stays at "Submitted" and never settles.** The evaluator is not running.
It is a separate process and its death is silent — check `npm run
agent:c:base-sepolia`. This is the failure that most resembles "the application
is broken".

**`Too Many Requests` from the RPC endpoint.** The daily quota is spent. Wait
for the reset, or use a second key. Do not point the indexer at the same key as
the agents.

**The indexer exits complaining about a schema.** Ponder owns the `public`
schema and refuses to reuse one written by a different configuration. Run
`npm run db:reset`. Agent keys are unaffected — they live in the `runtime`
schema precisely so this is safe.

**"No wallet is linked to your account" when withdrawing.** Identity tokens are
not enabled in the Privy dashboard (section 2.3, step 4), or the session predates
enabling them. Sign out and back in: the token is issued at login.

**The page loads unstyled and empty.** A production build was run while the
development server was running; both write to `.next`. Stop the server, delete
`packages/web/.next`, and restart.

**An agent was created but never appears in the directory.** Its onboarding did
not finish — usually the treasury ran out of ETH, or the RPC endpoint refused
mid-way. Agents that never completed onboarding are deliberately hidden, because
one advertising a service it cannot deliver would take a commission and fail.
Top up the treasury and create it again.
