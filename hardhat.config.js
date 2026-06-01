require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    nexus: {
      url: "https://testnet.rpc.nexus.xyz",
      chainId: 3945,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    nexustestnet: {
      url: "https://testnet.rpc.nexus.xyz",
      chainId: 3945,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
