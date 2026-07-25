import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

// Testnet keys are absent in the default local setup; an empty accounts array
// leaves baseSepolia configured but unusable rather than failing to load.
const baseSepoliaAccounts = [
  process.env.BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY,
].filter((key): key is string => Boolean(key));

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin v5 uses the mcopy opcode, which requires the Cancun target.
      evmVersion: "cancun",
    },
  },
  networks: {
    // In-process chain used by `hardhat test`.
    hardhat: {
      chainId: 31337,
    },
    // Standalone node started by `npm run chain`; deploy/seed target this.
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Opt-in testnet target. Local stays the default for dev and the demo.
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
