const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying NoteRegistry contract...");

  // Get the contract factory
  const NoteRegistry = await ethers.getContractFactory("NoteRegistry");

  // Deploy the contract
  const noteRegistry = await NoteRegistry.deploy();

  // Wait for deployment to complete
  await noteRegistry.deployed();

  console.log(`NoteRegistry deployed to: ${noteRegistry.address}`);
  console.log(`Transaction hash: ${noteRegistry.deployTransaction.hash}`);

  // Wait for a few confirmations
  console.log("Waiting for confirmations...");
  await noteRegistry.deployTransaction.wait(3);

  console.log("Deployment completed successfully!");

  // Verify the contract on Etherscan (if not on local network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: noteRegistry.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  // Display contract information
  console.log("\n=== Contract Information ===");
  console.log(`Network: ${network.name}`);
  console.log(`Contract Address: ${noteRegistry.address}`);
  console.log(`Deployer Address: ${(await ethers.getSigners())[0].address}`);
  console.log(`Gas Price: ${ethers.utils.formatUnits(noteRegistry.deployTransaction.gasPrice || 0, 'gwei')} gwei`);
  console.log(`Gas Used: ${noteRegistry.deployTransaction.gasLimit?.toString()}`);
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
