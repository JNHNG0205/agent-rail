import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/// Generate the testnet accounts, ready to paste.
///
/// Two are required — the evaluator and the treasury. The other three are
/// printed because they have uses: a deployer if you deploy your own contracts,
/// and two seed agents from the design that preceded the marketplace. Neither is
/// needed to run the system, and preflight no longer insists on them.
///
/// "Create five accounts in a wallet and export their private keys" is a page of
/// clicking and a good chance of pasting the wrong one into the wrong file. This
/// prints them in the exact shape the two env files expect, in the order the
/// system reads them.
///
/// TESTNET ONLY. These keys are generated on your machine and printed to your
/// terminal, which is fine for an account holding faucet ETH and unacceptable
/// for one holding anything real. Nothing here should ever be funded on a
/// network where value is at stake.
///
/// Roles are separated deliberately, and the separation is the design rather
/// than caution:
///
///   deployer   owns JobContract and ReputationRegistry, and an owner can
///              re-point the identity registry, the evaluator module and the
///              reputation registry. An agent holding this could rewrite the
///              rules constraining its own job, so it is never an agent.
///   evaluator  signs the verdict that settles or refunds. A client holding
///              this key could approve its own payment, which is the one thing
///              the whole design exists to prevent.
///   treasury   pays the first gas for every agent a user creates. It holds no
///              authority at all — only ETH.

interface Role {
  name: string;
  env: string;
  file: string;
  needsEth: string;
  why: string;
}

const ROLES: Role[] = [
  {
    name: "Deployer",
    env: "BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY",
    file: ".env",
    needsEth: "~0.05",
    why: "deploys the contracts; never an agent",
  },
  {
    name: "Agent A",
    env: "BASE_SEPOLIA_AGENT_A_PRIVATE_KEY",
    file: ".env",
    needsEth: "—",
    why: "optional seed client — users create their own agents",
  },
  {
    name: "Agent B",
    env: "BASE_SEPOLIA_AGENT_B_PRIVATE_KEY",
    file: ".env",
    needsEth: "—",
    why: "optional seed provider — users create their own agents",
  },
  {
    name: "Evaluator",
    env: "BASE_SEPOLIA_AGENT_C_PRIVATE_KEY",
    file: ".env and packages/agents/.env",
    needsEth: "~0.05",
    why: "signs the verdict that settles or refunds",
  },
  {
    name: "Treasury",
    env: "BASE_SEPOLIA_TREASURY_PRIVATE_KEY",
    file: "packages/agents/.env",
    needsEth: "~0.05",
    why: "pays each new agent's first gas",
  },
];

const generated = ROLES.map((role) => {
  const privateKey = generatePrivateKey();
  return { role, privateKey, address: privateKeyToAccount(privateKey).address };
});

console.log("\nTestnet accounts. TESTNET ONLY — never fund these on a real network.\n");

console.log("Only two are needed. Fund these from a Base Sepolia faucet:\n");
for (const { role, address } of generated) {
  if (role.needsEth !== "—" && role.name !== "Deployer") {
    console.log(`  ${role.name.padEnd(10)} ${address}   ${role.needsEth} ETH   (${role.why})`);
  }
}
console.log("\n  https://portal.cdp.coinbase.com/products/faucet   0.1 ETH per day");
console.log("  https://faucet.quicknode.com/base/sepolia         no account needed");
console.log("  https://www.ethereum-ecosystem.com/faucets/base-sepolia   0.5 ETH per day\n");

console.log("The deployer is needed only to deploy your own contracts — the ones this");
console.log("repository points at are already deployed and verified. Agents A and B are");
console.log("optional seeds from an earlier design; users create their own agents, which");
console.log("the treasury funds automatically.\n");

console.log("─".repeat(72));
console.log("\nPaste into .env\n");
for (const { role, privateKey } of generated) {
  if (role.file.includes(".env") && !role.file.startsWith("packages")) {
    console.log(`${role.env}=${privateKey}`);
  }
}

console.log("\nPaste into packages/agents/.env\n");
const evaluator = generated.find((g) => g.role.name === "Evaluator")!;
const treasury = generated.find((g) => g.role.name === "Treasury")!;
console.log(`BASE_SEPOLIA_AGENT_C_PRIVATE_KEY=${evaluator.privateKey}`);
// The address, not the key. Anything that creates a job needs to name the
// evaluator; giving it the key would let it sign its own verdict.
console.log(`BASE_SEPOLIA_EVALUATOR_ADDRESS=${evaluator.address}`);
console.log(`BASE_SEPOLIA_TREASURY_PRIVATE_KEY=${treasury.privateKey}`);
console.log("\n" + "─".repeat(72));
console.log("\nThen: npm run preflight:base-sepolia — it checks funding and registration.\n");
