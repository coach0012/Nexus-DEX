const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = "https://testnet.rpc.nexus.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

function requirePrivateKey() {
  if (!PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY in .env. Use a fresh Nexus testnet wallet only.");
  }
  return PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
}

function compileContracts() {
  const contractsDir = path.join(__dirname, "..", "contracts");
  const sources = {};
  for (const file of fs.readdirSync(contractsDir)) {
    if (file.endsWith(".sol")) {
      sources[file] = { content: fs.readFileSync(path.join(contractsDir, file), "utf8") };
    }
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const error of output.errors) {
      console.log(`${error.severity}: ${error.formattedMessage}`);
    }
    if (output.errors.some((error) => error.severity === "error")) {
      throw new Error("Solidity compilation failed.");
    }
  }
  return output.contracts;
}

function getArtifact(contracts, file, name) {
  const artifact = contracts[file]?.[name];
  if (!artifact) throw new Error(`Missing artifact ${file}:${name}`);
  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`
  };
}

async function deploy(wallet, artifact, args = []) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const key = requirePrivateKey();
  const provider = new ethers.JsonRpcProvider(RPC_URL, 3945);
  const wallet = new ethers.Wallet(key, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log("Deploying with:", wallet.address);
  console.log("NEX balance:", ethers.formatEther(balance));
  if (balance === 0n) {
    throw new Error("Deployer has 0 NEX. Get test NEX from https://faucet.nexus.xyz");
  }

  const contracts = compileContracts();
  const usdxArtifact = getArtifact(contracts, "USDXTestToken.sol", "USDXTestToken");
  const wrappedNexArtifact = getArtifact(contracts, "WrappedNEX.sol", "WrappedNEX");
  const factoryArtifact = getArtifact(contracts, "NexusDexFactory.sol", "NexusDexFactory");
  const routerArtifact = getArtifact(contracts, "NexusDexRouter.sol", "NexusDexRouter");

  const usdx = await deploy(wallet, usdxArtifact);
  console.log("USDXTestToken:", await usdx.getAddress());

  const wrappedNex = await deploy(wallet, wrappedNexArtifact);
  console.log("WrappedNEX:", await wrappedNex.getAddress());

  const dexFactory = await deploy(wallet, factoryArtifact, [wallet.address]);
  console.log("NexusDexFactory:", await dexFactory.getAddress());

  const router = await deploy(wallet, routerArtifact, [await dexFactory.getAddress()]);
  console.log("NexusDexRouter:", await router.getAddress());

  console.log("\nSet these in app.js:");
  console.log(`const USDX_ADDRESS = "${await usdx.getAddress()}";`);
  console.log(`const WNEX_ADDRESS = "${await wrappedNex.getAddress()}";`);
  console.log(`const ROUTER_ADDRESS = "${await router.getAddress()}";`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
