const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer. Set PRIVATE_KEY in .env.");
  }

  console.log("Deploying with:", deployer.address);

  const USDX = await hre.ethers.getContractFactory("USDXTestToken");
  const usdx = await USDX.deploy();
  await usdx.waitForDeployment();
  console.log("USDXTestToken:", await usdx.getAddress());

  const Factory = await hre.ethers.getContractFactory("NexusDexFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  console.log("NexusDexFactory:", await factory.getAddress());

  const Router = await hre.ethers.getContractFactory("NexusDexRouter");
  const router = await Router.deploy(await factory.getAddress());
  await router.waitForDeployment();
  console.log("NexusDexRouter:", await router.getAddress());

  console.log("\nSet these in app.js after deploy:");
  console.log(`const usdxFaucetAddress = "${await usdx.getAddress()}";`);
  console.log(`const routerAddress = "${await router.getAddress()}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
