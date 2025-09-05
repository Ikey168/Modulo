const { run } = require("hardhat");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

/**
 * Verify deployed contracts on PolygonScan
 */
async function verifyPolygonContracts() {
    console.log("🔍 Verifying contracts on PolygonScan...");
    
    // Read deployment info
    const deploymentPath = path.join(__dirname, "..", "deployments", "polygon-mainnet.json");
    
    if (!existsSync(deploymentPath)) {
        throw new Error("❌ Deployment file not found. Please deploy contracts first.");
    }
    
    const deploymentInfo = JSON.parse(readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;
    
    console.log("📋 Found deployment info:");
    console.log(`🔗 Network: ${deploymentInfo.network}`);
    console.log(`🕒 Deployed at: ${deploymentInfo.timestamp}`);
    console.log(`👤 Deployer: ${deploymentInfo.deployer}`);
    
    const verificationResults = {};
    
    try {
        // 1. Verify NoteRegistryOptimized
        console.log("\n📄 Verifying NoteRegistryOptimized...");
        try {
            await run("verify:verify", {
                address: contracts.noteRegistryOptimized.address,
                constructorArguments: [],
            });
            console.log("✅ NoteRegistryOptimized verified successfully!");
            verificationResults.noteRegistryOptimized = "verified";
        } catch (error) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️  NoteRegistryOptimized already verified");
                verificationResults.noteRegistryOptimized = "already_verified";
            } else {
                console.error("❌ Failed to verify NoteRegistryOptimized:", error.message);
                verificationResults.noteRegistryOptimized = "failed";
            }
        }
        
        // 2. Verify ModuloTokenOptimized
        console.log("\n🪙 Verifying ModuloTokenOptimized...");
        try {
            await run("verify:verify", {
                address: contracts.moduloTokenOptimized.address,
                constructorArguments: [],
            });
            console.log("✅ ModuloTokenOptimized verified successfully!");
            verificationResults.moduloTokenOptimized = "verified";
        } catch (error) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️  ModuloTokenOptimized already verified");
                verificationResults.moduloTokenOptimized = "already_verified";
            } else {
                console.error("❌ Failed to verify ModuloTokenOptimized:", error.message);
                verificationResults.moduloTokenOptimized = "failed";
            }
        }
        
        // 3. Verify NoteMonetization
        console.log("\n💰 Verifying NoteMonetization...");
        try {
            await run("verify:verify", {
                address: contracts.noteMonetization.address,
                constructorArguments: [
                    contracts.moduloTokenOptimized.address,
                    contracts.noteRegistryOptimized.address
                ],
            });
            console.log("✅ NoteMonetization verified successfully!");
            verificationResults.noteMonetization = "verified";
        } catch (error) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️  NoteMonetization already verified");
                verificationResults.noteMonetization = "already_verified";
            } else {
                console.error("❌ Failed to verify NoteMonetization:", error.message);
                verificationResults.noteMonetization = "failed";
            }
        }
        
        // Summary
        console.log("\n📊 VERIFICATION SUMMARY:");
        console.log("=" .repeat(50));
        Object.entries(verificationResults).forEach(([contract, status]) => {
            const emoji = status === "verified" ? "✅" : 
                         status === "already_verified" ? "ℹ️ " : "❌";
            console.log(`${emoji} ${contract}: ${status}`);
        });
        
        console.log("\n🔗 VIEW ON POLYGONSCAN:");
        console.log(`📄 NoteRegistryOptimized: https://polygonscan.com/address/${contracts.noteRegistryOptimized.address}`);
        console.log(`🪙 ModuloTokenOptimized: https://polygonscan.com/address/${contracts.moduloTokenOptimized.address}`);
        console.log(`💰 NoteMonetization: https://polygonscan.com/address/${contracts.noteMonetization.address}`);
        
        return verificationResults;
        
    } catch (error) {
        console.error("❌ Verification process failed:", error.message);
        throw error;
    }
}

// Run verification if called directly
if (require.main === module) {
    verifyPolygonContracts()
        .then((results) => {
            console.log("\n🎉 VERIFICATION COMPLETED!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 VERIFICATION FAILED:", error);
            process.exit(1);
        });
}

module.exports = { verifyPolygonContracts };
