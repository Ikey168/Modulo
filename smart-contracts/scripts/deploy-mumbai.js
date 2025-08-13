const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying NoteRegistry to Polygon Mumbai Testnet");
  console.log("====================================================");
  
  // Verify we're on Mumbai testnet
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 80001) {
    console.error(`❌ Wrong network! Expected Mumbai (80001), got ${network.chainId}`);
    console.error("Run with: npm run deploy:mumbai");
    process.exit(1);
  }
  
  console.log(`✅ Connected to Mumbai testnet (Chain ID: ${network.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await deployer.getBalance();
  
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} MATIC`);
  
  // Check minimum balance (0.01 MATIC)
  const minBalance = ethers.utils.parseEther("0.01");
  if (balance.lt(minBalance)) {
    console.error("❌ Insufficient MATIC balance!");
    console.error("You need at least 0.01 MATIC to deploy on Mumbai");
    console.error("Get test MATIC from: https://faucet.polygon.technology/");
    process.exit(1);
  }
  
  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log(`⛽ Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
  
  // Deploy with Mumbai-optimized settings
  console.log("\n🔨 Deploying NoteRegistry contract...");
  
  const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
  
  // Deploy with explicit gas settings for Mumbai
  const noteRegistry = await NoteRegistry.deploy({
    gasPrice: gasPrice,
    gasLimit: 3000000 // Generous gas limit for Mumbai
  });
  
  console.log(`📝 Deployment transaction: ${noteRegistry.deployTransaction.hash}`);
  console.log("⏳ Waiting for deployment confirmation...");
  
  // Wait for deployment
  await noteRegistry.deployed();
  
  const receipt = await noteRegistry.deployTransaction.wait();
  
  console.log("\n✅ Deployment successful!");
  console.log("====================================================");
  console.log(`📍 Contract Address: ${noteRegistry.address}`);
  console.log(`🏷️  Transaction Hash: ${noteRegistry.deployTransaction.hash}`);
  console.log(`🧱 Block Number: ${receipt.blockNumber}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`💰 Cost: ${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice))} MATIC`);
  console.log(`🔗 Mumbai PolygonScan: https://mumbai.polygonscan.com/address/${noteRegistry.address}`);
  
  // Wait for additional confirmations
  console.log("\n⏳ Waiting for 3 confirmations...");
  await noteRegistry.deployTransaction.wait(3);
  console.log("✅ 3 confirmations received");
  
  // Test the contract
  console.log("\n🧪 Testing contract functionality...");
  try {
    // Test basic read function
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`📊 Initial note count: ${totalNotes}`);
    
    // Test note registration
    const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Mumbai deployment test"));
    const testTitle = "Mumbai Deployment Test";
    
    console.log("📝 Registering test note...");
    const registerTx = await noteRegistry.registerNote(testHash, testTitle, {
      gasLimit: 200000
    });
    
    console.log(`📝 Registration tx: ${registerTx.hash}`);
    const registerReceipt = await registerTx.wait();
    
    console.log(`✅ Test note registered in block ${registerReceipt.blockNumber}`);
    
    // Verify the note
    const [exists, isOwner, isActive] = await noteRegistry.verifyNote(testHash);
    console.log(`🔍 Verification: exists=${exists}, isOwner=${isOwner}, isActive=${isActive}`);
    
    const newTotalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`📊 New note count: ${newTotalNotes}`);
    
  } catch (error) {
    console.error("⚠️  Contract test failed:", error.message);
  }
  
  // Verify on PolygonScan
  console.log("\n🔍 Verifying contract on PolygonScan...");
  try {
    await hre.run("verify:verify", {
      address: noteRegistry.address,
      constructorArguments: [],
      network: "mumbai"
    });
    console.log("✅ Contract verified on PolygonScan!");
  } catch (error) {
    console.log("⚠️  Verification failed:", error.message);
    console.log("You can verify manually with:");
    console.log(`npx hardhat verify --network mumbai ${noteRegistry.address}`);
  }
  
  // Save deployment info
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    network: "mumbai",
    chainId: 80001,
    address: noteRegistry.address,
    deployer: deployerAddress,
    blockNumber: receipt.blockNumber,
    transactionHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: receipt.effectiveGasPrice.toString(),
    cost: ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)),
    timestamp: new Date().toISOString(),
    explorerUrl: `https://mumbai.polygonscan.com/address/${noteRegistry.address}`
  };
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'mumbai.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n📋 Mumbai Deployment Summary");
  console.log("====================================================");
  console.log(`🌐 Network: Polygon Mumbai Testnet`);
  console.log(`📍 Contract: ${noteRegistry.address}`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Cost: ${deploymentInfo.cost} MATIC`);
  console.log(`🔗 Explorer: ${deploymentInfo.explorerUrl}`);
  console.log(`💾 Info saved to: deployments/mumbai.json`);
  
  console.log("\n🎉 Mumbai deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Test the contract using: npm run interact:mumbai");
  console.log("2. Update your frontend configuration with the contract address");
  console.log("3. Add the contract address to your .env file:");
  console.log(`   CONTRACT_ADDRESS_MUMBAI=${noteRegistry.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Mumbai deployment failed!");
    console.error("==================================");
    console.error("Error:", error.message);
    if (error.code) console.error("Code:", error.code);
    if (error.reason) console.error("Reason:", error.reason);
    console.error("\n💡 Common solutions:");
    console.error("- Ensure you have enough MATIC: https://faucet.polygon.technology/");
    console.error("- Check your MUMBAI_URL in .env file");
    console.error("- Verify your PRIVATE_KEY is correct");
    console.error("- Try increasing gas limit if transaction fails");
    console.error("==================================");
    process.exit(1);
  });
