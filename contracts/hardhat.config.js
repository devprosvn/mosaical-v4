
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    devpros: {
      url: process.env.RPC_URL || "https://devpros-2749656616387000-1.jsonrpc.sagarpc.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 2749656616387000,
      gasPrice: "auto",
      timeout: 60000
    },
    saga: {
      url: "https://devpros-2749656616387000-1.jsonrpc.sagarpc.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 2749656616387000,
      gasPrice: "auto",
      timeout: 60000
    },
    hardhat: {
      chainId: 1337,
      accounts: {
        accountsBalance: "10000000000000000000000000"
      }
    }
  },
  etherscan: {
    apiKey: {
      devpros: "empty"
    },
    customChains: [
      {
        network: "devpros",
        chainId: 2749656616387000,
        urls: {
          apiURL: "https://api-devpros-2749656616387000-1.sagaexplorer.io/api",
          browserURL: "https://devpros-2749656616387000-1.sagaexplorer.io:443"
        }
      }
    ]
  },
  sourcify: {
    enabled: false
  },
  paths: {
    sources: "./contracts",
    tests: "./test", 
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
