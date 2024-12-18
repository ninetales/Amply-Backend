import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const METAMASK_PRIVATE_KEY = process.env.METAMASK_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Ensure the required environment variables are defined
if (!INFURA_API_KEY) {
  throw new Error("INFURA_API_KEY is not defined");
}

if (!METAMASK_PRIVATE_KEY) {
  throw new Error("METAMASK_PRIVATE_KEY is not defined");
}

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  etherscan: {
    apiKey: `${ETHERSCAN_API_KEY}`
  },
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [`0x${METAMASK_PRIVATE_KEY}`],  // Add '0x' prefix to private key
    },
  }
};

export default config;
