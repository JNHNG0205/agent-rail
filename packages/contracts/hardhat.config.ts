import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";
import * as path from "path";

// Resolved against this file, not the process cwd. `import "dotenv/config"` reads
// ./.env relative to wherever the command was launched — for a workspace script
// that is packages/contracts, which has no .env, so every BASE_SEPOLIA_* key was
// silently invisible and baseSepolia came up with zero accounts.
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Order matters and must mirror the local chain, where Hardhat account #0 is
// both the deployer and Agent A: deploy.ts takes getWalletClients()[0] as the
// deployer, and seed.ts destructures [agentA, agentB, agentC] from the same
// list. Supplying only one key here left agentB and agentC undefined on
// testnet, so seeding crashed — invisible locally because Hardhat injects 20
// accounts of its own.
//
// Testnet keys are absent in a default local setup; an empty array leaves
// baseSepolia configured but unusable rather than failing the config load.
const baseSepoliaAccounts = [
  process.env.BASE_SEPOLIA_AGENT_A_PRIVATE_KEY,
  process.env.BASE_SEPOLIA_AGENT_B_PRIVATE_KEY,
  process.env.BASE_SEPOLIA_AGENT_C_PRIVATE_KEY,
].filter((key): key is string => Boolean(key));

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    // Standalone node started by `npm run chain`; deploy/seed default here.
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts: baseSepoliaAccounts,
    },
  },
  etherscan: {
    apiKey: { baseSepolia: process.env.BASESCAN_API_KEY ?? "" },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
