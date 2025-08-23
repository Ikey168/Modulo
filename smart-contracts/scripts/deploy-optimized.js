const { ethers } = require("hardhat");
const { writeFileSync, existsSync, mkdirSync } = require("fs");
const path = require("path");

/**
 * Deploy optimized and security-enhanced smart contracts
 */
async function deployOptimizedContracts() {
    console.log("🚀 Deploying optimized smart contracts...");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    const deployments = {};
    const gasReport = {};

    try {
        // Deploy NoteRegistryOptimized
        console.log("\n📄 Deploying NoteRegistryOptimized...");
        const NoteRegistryOptimized = await ethers.getContractFactory("NoteRegistryOptimized");
        const estimatedGas1 = await NoteRegistryOptimized.signer.estimateGas(
            NoteRegistryOptimized.getDeployTransaction()
        );
        console.log(`⛽ Estimated deployment gas: ${estimatedGas1.toString()}`);
        
        const noteRegistryOptimized = await NoteRegistryOptimized.deploy();
        await noteRegistryOptimized.deployed();
        
        const deployReceipt1 = await noteRegistryOptimized.deployTransaction.wait();
        console.log("✅ NoteRegistryOptimized deployed to:", noteRegistryOptimized.address);
        console.log(`⛽ Actual gas used: ${deployReceipt1.gasUsed.toString()}`);
        
        deployments.noteRegistryOptimized = {
            address: noteRegistryOptimized.address,
            deploymentHash: noteRegistryOptimized.deployTransaction.hash,
            gasUsed: deployReceipt1.gasUsed.toString(),
            blockNumber: deployReceipt1.blockNumber
        };
        gasReport.noteRegistryOptimized = {
            estimated: estimatedGas1.toString(),
            actual: deployReceipt1.gasUsed.toString()
        };

        // Deploy ModuloTokenOptimized
        console.log("\n🪙 Deploying ModuloTokenOptimized...");
        const ModuloTokenOptimized = await ethers.getContractFactory("ModuloTokenOptimized");
        const estimatedGas2 = await ModuloTokenOptimized.signer.estimateGas(
            ModuloTokenOptimized.getDeployTransaction()
        );
        console.log(`⛽ Estimated deployment gas: ${estimatedGas2.toString()}`);
        
        const moduloTokenOptimized = await ModuloTokenOptimized.deploy();
        await moduloTokenOptimized.deployed();
        
        const deployReceipt2 = await moduloTokenOptimized.deployTransaction.wait();
        console.log("✅ ModuloTokenOptimized deployed to:", moduloTokenOptimized.address);
        console.log(`⛽ Actual gas used: ${deployReceipt2.gasUsed.toString()}`);
        
        deployments.moduloTokenOptimized = {
            address: moduloTokenOptimized.address,
            deploymentHash: moduloTokenOptimized.deployTransaction.hash,
            gasUsed: deployReceipt2.gasUsed.toString(),
            blockNumber: deployReceipt2.blockNumber
        };
        gasReport.moduloTokenOptimized = {
            estimated: estimatedGas2.toString(),
            actual: deployReceipt2.gasUsed.toString()
        };

        // Verify contract interfaces
        console.log("\n🔍 Verifying contract interfaces...");
        
        // Test NoteRegistryOptimized
        const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
        const registerTx = await noteRegistryOptimized.registerNote(testHash);
        const registerReceipt = await registerTx.wait();
        console.log(`✅ Test note registered, gas used: ${registerReceipt.gasUsed.toString()}`);
        
        // Test ModuloTokenOptimized
        const mintTx = await moduloTokenOptimized.mint(deployer.address, ethers.utils.parseEther("1000"));
        const mintReceipt = await mintTx.wait();
        console.log(`✅ Test tokens minted, gas used: ${mintReceipt.gasUsed.toString()}`);

        // Add minter for testing
        const addMinterTx = await moduloTokenOptimized.addMinter(deployer.address, ethers.utils.parseEther("1000000"));
        await addMinterTx.wait();
        console.log("✅ Test minter added");

        // Save deployment information
        const deploymentsDir = path.join(__dirname, "../deployments");
        if (!existsSync(deploymentsDir)) {
            mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentInfo = {
            timestamp: new Date().toISOString(),
            network: await ethers.provider.getNetwork(),
            deployer: deployer.address,
            contracts: deployments,
            gasReport: gasReport,
            totalGasUsed: Object.values(gasReport).reduce((sum, contract) => 
                sum + parseInt(contract.actual), 0
            ).toString()
        };

        const deploymentPath = path.join(deploymentsDir, `optimized-contracts-${Date.now()}.json`);
        writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📁 Deployment info saved to: ${deploymentPath}`);

        // Generate deployment summary
        const summary = `# Optimized Contract Deployment Summary

**Deployment Date:** ${deploymentInfo.timestamp}
**Network:** ${deploymentInfo.network.name} (Chain ID: ${deploymentInfo.network.chainId})
**Deployer:** ${deploymentInfo.deployer}

## Deployed Contracts

### NoteRegistryOptimized
- **Address:** \`${deployments.noteRegistryOptimized.address}\`
- **Gas Used:** ${deployments.noteRegistryOptimized.gasUsed}
- **Block:** ${deployments.noteRegistryOptimized.blockNumber}
- **Transaction:** \`${deployments.noteRegistryOptimized.deploymentHash}\`

### ModuloTokenOptimized  
- **Address:** \`${deployments.moduloTokenOptimized.address}\`
- **Gas Used:** ${deployments.moduloTokenOptimized.gasUsed}
- **Block:** ${deployments.moduloTokenOptimized.blockNumber}
- **Transaction:** \`${deployments.moduloTokenOptimized.deploymentHash}\`

## Gas Usage Summary

| Contract | Estimated Gas | Actual Gas | Efficiency |
|----------|---------------|------------|------------|
| NoteRegistryOptimized | ${gasReport.noteRegistryOptimized.estimated} | ${gasReport.noteRegistryOptimized.actual} | ${((parseInt(gasReport.noteRegistryOptimized.estimated) - parseInt(gasReport.noteRegistryOptimized.actual)) / parseInt(gasReport.noteRegistryOptimized.estimated) * 100).toFixed(2)}% savings |
| ModuloTokenOptimized | ${gasReport.moduloTokenOptimized.estimated} | ${gasReport.moduloTokenOptimized.actual} | ${((parseInt(gasReport.moduloTokenOptimized.estimated) - parseInt(gasReport.moduloTokenOptimized.actual)) / parseInt(gasReport.moduloTokenOptimized.estimated) * 100).toFixed(2)}% savings |

**Total Gas Used:** ${deploymentInfo.totalGasUsed}

## Verification Commands

\`\`\`bash
# Verify NoteRegistryOptimized
npx hardhat verify --network ${deploymentInfo.network.name} ${deployments.noteRegistryOptimized.address}

# Verify ModuloTokenOptimized
npx hardhat verify --network ${deploymentInfo.network.name} ${deployments.moduloTokenOptimized.address}
\`\`\`

## Next Steps

1. ✅ Contracts deployed successfully
2. 🔍 Run security tests on deployed contracts
3. 📊 Monitor gas usage in production
4. 🔐 Consider timelock for admin functions
5. 📈 Set up monitoring and alerting

## Test Contract Interactions

\`\`\`javascript
// Connect to deployed contracts
const noteRegistry = await ethers.getContractAt("NoteRegistryOptimized", "${deployments.noteRegistryOptimized.address}");
const token = await ethers.getContractAt("ModuloTokenOptimized", "${deployments.moduloTokenOptimized.address}");

// Example usage
const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("my note"));
await noteRegistry.registerNote(hash);
await token.mint(userAddress, ethers.utils.parseEther("100"));
\`\`\`
`;

        const summaryPath = path.join(deploymentsDir, "deployment-summary.md");
        writeFileSync(summaryPath, summary);
        console.log(`📄 Deployment summary saved to: ${summaryPath}`);

        console.log("\n🎉 Deployment completed successfully!");
        console.log("📊 Contract addresses:");
        console.log(`   📄 NoteRegistryOptimized: ${deployments.noteRegistryOptimized.address}`);
        console.log(`   🪙 ModuloTokenOptimized: ${deployments.moduloTokenOptimized.address}`);

        return deployments;

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

/**
 * Benchmark gas usage comparison
 */
async function benchmarkGasUsage() {
    console.log("\n📊 Running gas usage benchmarks...");
    
    try {
        // Deploy both original and optimized contracts for comparison
        const NoteRegistry = await ethers.getContractFactory("NoteRegistry");
        const NoteRegistryOptimized = await ethers.getContractFactory("NoteRegistryOptimized");
        
        console.log("🔄 Deploying contracts for comparison...");
        const originalRegistry = await NoteRegistry.deploy();
        const optimizedRegistry = await NoteRegistryOptimized.deploy();
        
        await originalRegistry.deployed();
        await optimizedRegistry.deployed();
        
        // Benchmark operations
        const benchmarks = {};
        
        // Note registration benchmark
        const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("benchmark note 1"));
        const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("benchmark note 2"));
        
        const originalRegisterTx = await originalRegistry.registerNote(hash1, "Benchmark Note");
        const originalReceipt = await originalRegisterTx.wait();
        
        const optimizedRegisterTx = await optimizedRegistry.registerNote(hash2);
        const optimizedReceipt = await optimizedRegisterTx.wait();
        
        benchmarks.noteRegistration = {
            original: originalReceipt.gasUsed.toString(),
            optimized: optimizedReceipt.gasUsed.toString(),
            savings: originalReceipt.gasUsed.sub(optimizedReceipt.gasUsed).toString(),
            percentage: ((originalReceipt.gasUsed.sub(optimizedReceipt.gasUsed)).mul(100).div(originalReceipt.gasUsed)).toString()
        };
        
        console.log("📊 Gas Benchmark Results:");
        console.log(`   Note Registration:`);
        console.log(`     Original: ${benchmarks.noteRegistration.original} gas`);
        console.log(`     Optimized: ${benchmarks.noteRegistration.optimized} gas`);
        console.log(`     Savings: ${benchmarks.noteRegistration.savings} gas (${benchmarks.noteRegistration.percentage}%)`);
        
        // Save benchmark results
        const benchmarkPath = path.join(__dirname, "../deployments/gas-benchmarks.json");
        writeFileSync(benchmarkPath, JSON.stringify(benchmarks, null, 2));
        console.log(`💾 Benchmark results saved to: ${benchmarkPath}`);
        
        return benchmarks;
        
    } catch (error) {
        console.error("❌ Benchmark failed:", error);
        throw error;
    }
}

// Main execution
async function main() {
    console.log("🔧 Smart Contract Security & Gas Optimization Deployment");
    console.log("=======================================================");
    
    // Deploy optimized contracts
    const deployments = await deployOptimizedContracts();
    
    // Run benchmarks
    const benchmarks = await benchmarkGasUsage();
    
    console.log("\n✅ All operations completed successfully!");
    return { deployments, benchmarks };
}

// Export for testing
module.exports = { deployOptimizedContracts, benchmarkGasUsage };

// Execute if run directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
