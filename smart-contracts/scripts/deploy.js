const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying NoteRegistry contract...");
  console.log("==========================================");

  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`📡 Network: ${networkName} (Chain ID: ${network.chainId})`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await deployer.getBalance();
  
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ${getNetworkCurrency(network.chainId)}`);

  // Check minimum balance requirements
  const minBalance = getMinimumBalance(network.chainId);
  if (balance.lt(ethers.utils.parseEther(minBalance))) {
    console.error(`❌ Insufficient balance. Minimum required: ${minBalance} ${getNetworkCurrency(network.chainId)}`);
    process.exit(1);
  }

  // Get gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log(`⛽ Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
  
  // Get the contract factory
  const NoteRegistry = await ethers.getContractFactory("NoteRegistry");

  // Estimate deployment gas
  const deployTx = NoteRegistry.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deployTx);
  const estimatedCost = gasPrice.mul(estimatedGas);
  
  console.log(`📊 Estimated Gas: ${estimatedGas.toString()}`);
  console.log(`💸 Estimated Cost: ${ethers.utils.formatEther(estimatedCost)} ${getNetworkCurrency(network.chainId)}`);

  // Deploy the contract
  console.log("\n🔨 Deploying contract...");
  const noteRegistry = await NoteRegistry.deploy({
    gasPrice: gasPrice,
    gasLimit: estimatedGas.add(100000) // Add buffer
  });

  console.log(`📝 Transaction hash: ${noteRegistry.deployTransaction.hash}`);
  console.log("⏳ Waiting for deployment confirmation...");

  // Wait for deployment to complete
  await noteRegistry.deployed();

  const deploymentReceipt = await noteRegistry.deployTransaction.wait();
  
  console.log("\n✅ Deployment successful!");
  console.log("==========================================");
  console.log(`📍 Contract Address: ${noteRegistry.address}`);
  console.log(`🏷️  Transaction Hash: ${noteRegistry.deployTransaction.hash}`);
  console.log(`🧱 Block Number: ${deploymentReceipt.blockNumber}`);
  console.log(`⛽ Gas Used: ${deploymentReceipt.gasUsed.toString()}`);
  console.log(`💰 Actual Cost: ${ethers.utils.formatEther(deploymentReceipt.gasUsed.mul(deploymentReceipt.effectiveGasPrice))} ${getNetworkCurrency(network.chainId)}`);

  // Wait for additional confirmations
  const confirmations = getRequiredConfirmations(network.chainId);
  if (confirmations > 1) {
    console.log(`\n⏳ Waiting for ${confirmations} confirmations...`);
    await noteRegistry.deployTransaction.wait(confirmations);
    console.log(`✅ ${confirmations} confirmations received`);
  }

  // Verify the contract on block explorer (if not on local network)
  if (shouldVerifyContract(network.chainId)) {
    console.log("\n🔍 Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: noteRegistry.address,
        constructorArguments: [],
        network: networkName
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
      console.log("You can verify manually later using:");
      console.log(`npx hardhat verify --network ${networkName} ${noteRegistry.address}`);
    }
  }

  // Test basic contract functionality
  console.log("\n🧪 Testing basic contract functionality...");
  try {
    const totalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`📊 Initial note count: ${totalNotes}`);
    
    // Test note registration
    const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Test deployment note"));
    const testTitle = "Deployment Test Note";
    
    console.log("🔄 Testing note registration...");
    const registerTx = await noteRegistry.registerNote(testHash, testTitle);
    await registerTx.wait();
    
    const newTotalNotes = await noteRegistry.getTotalNoteCount();
    console.log(`✅ Note registered successfully! New count: ${newTotalNotes}`);
    
    // Verify the note
    const [exists, isOwner, isActive] = await noteRegistry.verifyNote(testHash);
    console.log(`✅ Note verification: exists=${exists}, isOwner=${isOwner}, isActive=${isActive}`);
    
  } catch (error) {
    console.error("❌ Contract functionality test failed:", error.message);
  }

  // Display contract information summary
  console.log("\n📋 Deployment Summary");
  console.log("==========================================");
  console.log(`🌐 Network: ${networkName} (${network.chainId})`);
  console.log(`📍 Contract: ${noteRegistry.address}`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`🔗 Explorer: ${getExplorerUrl(network.chainId, noteRegistry.address)}`);
  
  // Save deployment info to file
  saveDeploymentInfo(network.chainId, noteRegistry.address, deploymentReceipt);
  
  console.log("\n🎉 Deployment completed successfully!");
}

function getNetworkCurrency(chainId) {
  switch (chainId) {
    case 1: // Mainnet
    case 11155111: // Sepolia
    case 1337: // Local
    case 31337: // Hardhat
      return "ETH";
    case 137: // Polygon
    case 80001: // Mumbai
      return "MATIC";
    default:
      return "ETH";
  }
}

function getMinimumBalance(chainId) {
  switch (chainId) {
    case 1: // Mainnet
      return "0.05";
    case 137: // Polygon
      return "0.1";
    case 11155111: // Sepolia
    case 80001: // Mumbai
      return "0.01";
    default:
      return "0.01";
  }
}

function getRequiredConfirmations(chainId) {
  switch (chainId) {
    case 1: // Mainnet
    case 137: // Polygon
      return 5;
    case 11155111: // Sepolia
    case 80001: // Mumbai
      return 3;
    default:
      return 1;
  }
}

function shouldVerifyContract(chainId) {
  // Don't verify on local networks
  return chainId !== 1337 && chainId !== 31337;
}

function getExplorerUrl(chainId, address) {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/address/${address}`;
    case 11155111:
      return `https://sepolia.etherscan.io/address/${address}`;
    case 137:
      return `https://polygonscan.com/address/${address}`;
    case 80001:
      return `https://mumbai.polygonscan.com/address/${address}`;
    default:
      return `Local network - no explorer`;
  }
}

function saveDeploymentInfo(chainId, address, receipt) {
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    chainId,
    address,
    blockNumber: receipt.blockNumber,
    transactionHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString()
  };
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const networkName = getNetworkName(chainId);
  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${filePath}`);
}

function getNetworkName(chainId) {
  switch (chainId) {
    case 1: return "mainnet";
    case 11155111: return "sepolia";
    case 137: return "polygon";
    case 80001: return "mumbai";
    case 1337:
    case 31337: return "localhost";
    default: return `chain-${chainId}`;
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed!");
    console.error("==========================================");
    console.error("Error:", error.message);
    if (error.code) {
      console.error("Code:", error.code);
    }
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    console.error("==========================================");
    process.exit(1);
  });
