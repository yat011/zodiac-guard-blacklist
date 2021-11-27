import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { HttpNetworkUserConfig } from "hardhat/types";
import "./src/tasks/deploy_verify"
import "./src/tasks/tasks"
import "./src/tasks/deploy_all"
require('solidity-coverage');

dotenv.config();
const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY } = process.env;


// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const sharedNetworkConfig: HttpNetworkUserConfig = {}
sharedNetworkConfig.accounts = {
  mnemonic: MNEMONIC || "none",
};
const config: HardhatUserConfig = {
  solidity: "0.8.9",
  paths: {
    deploy: "src/deploy",
  },
  namedAccounts: {
    deployer: 0,
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
