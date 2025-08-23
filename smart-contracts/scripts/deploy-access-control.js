const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying NoteRegistryWithAccessControl...");

  // Get the contract factory
  const NoteRegistryWithAccessControl = await ethers.getContractFactory("NoteRegistryWithAccessControl");

  // Deploy the contract
  const noteRegistry = await NoteRegistryWithAccessControl.deploy();
  await noteRegistry.deployed();

  console.log("✅ NoteRegistryWithAccessControl deployed to:", noteRegistry.address);
  console.log("📄 Transaction hash:", noteRegistry.deployTransaction.hash);

  // Wait for a few confirmations
  console.log("⏳ Waiting for confirmations...");
  await noteRegistry.deployTransaction.wait(3);

  console.log("🎉 Deployment completed successfully!");
  console.log("📝 Contract details:");
  console.log(`  - Address: ${noteRegistry.address}`);
  console.log(`  - Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  - Block: ${noteRegistry.deployTransaction.blockNumber}`);

  // Verify basic functionality
  try {
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`  - Initial note count: ${totalNotes}`);
    console.log("✅ Contract verification successful!");
  } catch (error) {
    console.log("❌ Contract verification failed:", error.message);
  }

  return noteRegistry.address;
}

// Export for testing
module.exports = main;

// Run if called directly
if (require.main === module) {
  main()
    .then((address) => {
      console.log(`\n🎯 Deployment Summary:`);
      console.log(`   Contract: NoteRegistryWithAccessControl`);
      console.log(`   Address: ${address}`);
      console.log(`   Status: Successfully deployed`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Deployment failed:", error);
      process.exit(1);
    });
}
