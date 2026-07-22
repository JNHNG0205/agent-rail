import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

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
  },
};

export default config;
