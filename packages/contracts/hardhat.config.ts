import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

// Testnet keys are absent in the default local setup; an empty accounts array
// leaves baseSepolia configured but unusable rather than failing to load.
const baseSepoliaAccounts = [
  process.env.BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY,
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
