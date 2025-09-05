const { ethers } = require("hardhat");
const { writeFileSync, existsSync, mkdirSync } = require("fs");
const path = require("path");

/**
 * Deploy optimized smart contracts to Polygon Mainnet
 * This script deploys the final production-ready contracts
 */
async function deployToPolygonMainnet() {
    console.log("🚀 Deploying to Polygon Mainnet...");
    console.log("🔗 Network:", hre.network.name);
    console.log("🆔 Chain ID:", hre.network.config.chainId);
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "MATIC");
    
    // Check minimum balance (0.1 MATIC for deployment)
    const minBalance = ethers.utils.parseEther("0.1");
    if (balance.lt(minBalance)) {
        throw new Error(`❌ Insufficient balance! Need at least 0.1 MATIC, have ${ethers.utils.formatEther(balance)} MATIC`);
    }

    const deployments = {};
    const gasReport = {};
    const timestamp = new Date().toISOString();

    try {
        // 1. Deploy NoteRegistryOptimized (Core contract for note verification)
        console.log("\n📄 Deploying NoteRegistryOptimized...");
        const NoteRegistryOptimized = await ethers.getContractFactory("NoteRegistryOptimized");
        
        const estimatedGas1 = await NoteRegistryOptimized.signer.estimateGas(
            NoteRegistryOptimized.getDeployTransaction()
        );
        console.log(`⛽ Estimated deployment gas: ${estimatedGas1.toString()}`);
        
        // Get current gas price
        const gasPrice = await deployer.provider.getGasPrice();
        console.log(`💨 Current gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
        console.log(`💵 Estimated cost: ${ethers.utils.formatEther(estimatedGas1.mul(gasPrice))} MATIC`);
        
        const noteRegistryOptimized = await NoteRegistryOptimized.deploy({
            gasLimit: estimatedGas1.add(100000), // Add buffer
            gasPrice: gasPrice
        });
        
        console.log("⏳ Waiting for deployment transaction...");
        await noteRegistryOptimized.deployed();
        
        const deployReceipt1 = await noteRegistryOptimized.deployTransaction.wait();
        console.log("✅ NoteRegistryOptimized deployed to:", noteRegistryOptimized.address);
        console.log(`⛽ Actual gas used: ${deployReceipt1.gasUsed.toString()}`);
        console.log(`🧾 Transaction hash: ${noteRegistryOptimized.deployTransaction.hash}`);
        console.log(`📦 Block number: ${deployReceipt1.blockNumber}`);
        
        deployments.noteRegistryOptimized = {
            address: noteRegistryOptimized.address,
            deploymentHash: noteRegistryOptimized.deployTransaction.hash,
            gasUsed: deployReceipt1.gasUsed.toString(),
            blockNumber: deployReceipt1.blockNumber,
            gasPrice: gasPrice.toString(),
            deploymentCost: ethers.utils.formatEther(deployReceipt1.gasUsed.mul(gasPrice))
        };
        
        gasReport.noteRegistryOptimized = {
            estimated: estimatedGas1.toString(),
            actual: deployReceipt1.gasUsed.toString(),
            savings: estimatedGas1.sub(deployReceipt1.gasUsed).toString()
        };

        // 2. Deploy ModuloTokenOptimized (Utility token for the platform)
        console.log("\n🪙 Deploying ModuloTokenOptimized...");
        const ModuloTokenOptimized = await ethers.getContractFactory("ModuloTokenOptimized");
        
        const estimatedGas2 = await ModuloTokenOptimized.signer.estimateGas(
            ModuloTokenOptimized.getDeployTransaction()
        );
        console.log(`⛽ Estimated deployment gas: ${estimatedGas2.toString()}`);
        console.log(`💵 Estimated cost: ${ethers.utils.formatEther(estimatedGas2.mul(gasPrice))} MATIC`);
        
        const moduloTokenOptimized = await ModuloTokenOptimized.deploy({
            gasLimit: estimatedGas2.add(100000), // Add buffer
            gasPrice: gasPrice
        });
        
        console.log("⏳ Waiting for deployment transaction...");
        await moduloTokenOptimized.deployed();
        
        const deployReceipt2 = await moduloTokenOptimized.deployTransaction.wait();
        console.log("✅ ModuloTokenOptimized deployed to:", moduloTokenOptimized.address);
        console.log(`⛽ Actual gas used: ${deployReceipt2.gasUsed.toString()}`);
        console.log(`🧾 Transaction hash: ${moduloTokenOptimized.deployTransaction.hash}`);
        console.log(`📦 Block number: ${deployReceipt2.blockNumber}`);
        
        deployments.moduloTokenOptimized = {
            address: moduloTokenOptimized.address,
            deploymentHash: moduloTokenOptimized.deployTransaction.hash,
            gasUsed: deployReceipt2.gasUsed.toString(),
            blockNumber: deployReceipt2.blockNumber,
            gasPrice: gasPrice.toString(),
            deploymentCost: ethers.utils.formatEther(deployReceipt2.gasUsed.mul(gasPrice))
        };
        
        gasReport.moduloTokenOptimized = {
            estimated: estimatedGas2.toString(),
            actual: deployReceipt2.gasUsed.toString(),
            savings: estimatedGas2.sub(deployReceipt2.gasUsed).toString()
        };

        // 3. Deploy NoteMonetization (Advanced features for note monetization)
        console.log("\n💰 Deploying NoteMonetization...");
        const NoteMonetization = await ethers.getContractFactory("NoteMonetization");
        
        const estimatedGas3 = await NoteMonetization.signer.estimateGas(
            NoteMonetization.getDeployTransaction(
                moduloTokenOptimized.address, // Token contract address
                noteRegistryOptimized.address  // Note registry contract address
            )
        );
        console.log(`⛽ Estimated deployment gas: ${estimatedGas3.toString()}`);
        console.log(`💵 Estimated cost: ${ethers.utils.formatEther(estimatedGas3.mul(gasPrice))} MATIC`);
        
        const noteMonetization = await NoteMonetization.deploy(
            moduloTokenOptimized.address,
            noteRegistryOptimized.address,
            {
                gasLimit: estimatedGas3.add(100000), // Add buffer
                gasPrice: gasPrice
            }
        );
        
        console.log("⏳ Waiting for deployment transaction...");
        await noteMonetization.deployed();
        
        const deployReceipt3 = await noteMonetization.deployTransaction.wait();
        console.log("✅ NoteMonetization deployed to:", noteMonetization.address);
        console.log(`⛽ Actual gas used: ${deployReceipt3.gasUsed.toString()}`);
        console.log(`🧾 Transaction hash: ${noteMonetization.deployTransaction.hash}`);
        console.log(`📦 Block number: ${deployReceipt3.blockNumber}`);
        
        deployments.noteMonetization = {
            address: noteMonetization.address,
            deploymentHash: noteMonetization.deployTransaction.hash,
            gasUsed: deployReceipt3.gasUsed.toString(),
            blockNumber: deployReceipt3.blockNumber,
            gasPrice: gasPrice.toString(),
            deploymentCost: ethers.utils.formatEther(deployReceipt3.gasUsed.mul(gasPrice))
        };
        
        gasReport.noteMonetization = {
            estimated: estimatedGas3.toString(),
            actual: deployReceipt3.gasUsed.toString(),
            savings: estimatedGas3.sub(deployReceipt3.gasUsed).toString()
        };

        // Calculate total deployment cost
        const totalGasUsed = deployReceipt1.gasUsed
            .add(deployReceipt2.gasUsed)
            .add(deployReceipt3.gasUsed);
        const totalCost = totalGasUsed.mul(gasPrice);
        
        console.log("\n🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
        console.log("=" .repeat(60));
        console.log(`⛽ Total gas used: ${totalGasUsed.toString()}`);
        console.log(`💵 Total deployment cost: ${ethers.utils.formatEther(totalCost)} MATIC`);
        console.log(`💰 Remaining balance: ${ethers.utils.formatEther(await deployer.getBalance())} MATIC`);

        // Verify contract addresses
        console.log("\n📋 CONTRACT ADDRESSES:");
        console.log(`🔗 NoteRegistryOptimized: ${noteRegistryOptimized.address}`);
        console.log(`🔗 ModuloTokenOptimized: ${moduloTokenOptimized.address}`);
        console.log(`🔗 NoteMonetization: ${noteMonetization.address}`);

        // Save deployment info
        const deploymentInfo = {
            network: "polygon-mainnet",
            chainId: 137,
            timestamp,
            deployer: deployer.address,
            gasPrice: gasPrice.toString(),
            totalGasUsed: totalGasUsed.toString(),
            totalCost: ethers.utils.formatEther(totalCost),
            contracts: deployments
        };

        // Save to multiple locations for redundancy
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!existsSync(deploymentsDir)) {
            mkdirSync(deploymentsDir, { recursive: true });
        }

        // Main deployment file
        writeFileSync(
            path.join(deploymentsDir, "polygon-mainnet.json"),
            JSON.stringify(deploymentInfo, null, 2)
        );

        // Backup with timestamp
        writeFileSync(
            path.join(deploymentsDir, `polygon-mainnet-${Date.now()}.json`),
            JSON.stringify(deploymentInfo, null, 2)
        );

        // Gas report
        writeFileSync(
            path.join(deploymentsDir, "polygon-mainnet-gas-report.json"),
            JSON.stringify(gasReport, null, 2)
        );

        console.log("\n💾 Deployment info saved to:");
        console.log(`📄 ${path.join(deploymentsDir, "polygon-mainnet.json")}`);
        console.log(`📄 ${path.join(deploymentsDir, "polygon-mainnet-gas-report.json")}`);

        // Contract verification instructions
        console.log("\n🔍 TO VERIFY CONTRACTS ON POLYGONSCAN:");
        console.log(`npx hardhat verify --network polygon ${noteRegistryOptimized.address}`);
        console.log(`npx hardhat verify --network polygon ${moduloTokenOptimized.address}`);
        console.log(`npx hardhat verify --network polygon ${noteMonetization.address} "${moduloTokenOptimized.address}" "${noteRegistryOptimized.address}"`);

        return {
            noteRegistry: noteRegistryOptimized.address,
            moduloToken: moduloTokenOptimized.address,
            noteMonetization: noteMonetization.address,
            deploymentInfo
        };

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        
        // Save error log
        const errorLog = {
            timestamp,
            error: error.message,
            stack: error.stack,
            network: "polygon-mainnet",
            deployer: deployer.address
        };
        
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!existsSync(deploymentsDir)) {
            mkdirSync(deploymentsDir, { recursive: true });
        }
        
        writeFileSync(
            path.join(deploymentsDir, `polygon-mainnet-error-${Date.now()}.json`),
            JSON.stringify(errorLog, null, 2)
        );
        
        throw error;
    }
}

// Run deployment if called directly
if (require.main === module) {
    deployToPolygonMainnet()
        .then((result) => {
            console.log("\n🎊 DEPLOYMENT COMPLETED SUCCESSFULLY!");
            console.log("🔗 Contract addresses available in deployments/polygon-mainnet.json");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 DEPLOYMENT FAILED:", error);
            process.exit(1);
        });
}

module.exports = { deployToPolygonMainnet };
