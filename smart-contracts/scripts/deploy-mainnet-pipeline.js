const { deployToPolygonMainnet } = require("./deploy-polygon-mainnet");
const { verifyPolygonContracts } = require("./verify-polygon-mainnet");
const { updateBackendConfiguration } = require("./update-backend-config");
const { updateFrontendConfiguration } = require("./update-frontend-config");
const { generateConfigurations } = require("./generate-configs");
const { writeFileSync, existsSync, mkdirSync } = require("fs");
const path = require("path");

/**
 * Master deployment script for Polygon Mainnet
 * Orchestrates the entire deployment and configuration process
 */
async function deployAndConfigureMainnet() {
    console.log("🚀 POLYGON MAINNET DEPLOYMENT MASTER SCRIPT");
    console.log("=" .repeat(60));
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    const startTime = Date.now();
    const deploymentLog = {
        startTime: new Date().toISOString(),
        steps: [],
        errors: [],
        warnings: []
    };
    
    try {
        // Step 1: Deploy contracts to Polygon Mainnet
        console.log("\n📦 STEP 1: Deploying contracts to Polygon Mainnet...");
        deploymentLog.steps.push({ step: 1, name: "Contract Deployment", startTime: new Date().toISOString() });
        
        const deploymentResult = await deployToPolygonMainnet();
        console.log("✅ Contracts deployed successfully!");
        
        deploymentLog.steps[0].endTime = new Date().toISOString();
        deploymentLog.steps[0].result = "success";
        deploymentLog.steps[0].data = deploymentResult;
        
        // Wait a bit for contracts to be indexed
        console.log("⏳ Waiting for contracts to be indexed...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Step 2: Verify contracts on PolygonScan
        console.log("\n🔍 STEP 2: Verifying contracts on PolygonScan...");
        deploymentLog.steps.push({ step: 2, name: "Contract Verification", startTime: new Date().toISOString() });
        
        try {
            const verificationResult = await verifyPolygonContracts();
            console.log("✅ Contract verification completed!");
            
            deploymentLog.steps[1].endTime = new Date().toISOString();
            deploymentLog.steps[1].result = "success";
            deploymentLog.steps[1].data = verificationResult;
        } catch (verifyError) {
            console.warn("⚠️  Contract verification had issues:", verifyError.message);
            deploymentLog.warnings.push(`Contract verification: ${verifyError.message}`);
            
            deploymentLog.steps[1].endTime = new Date().toISOString();
            deploymentLog.steps[1].result = "partial";
            deploymentLog.steps[1].error = verifyError.message;
        }
        
        // Step 3: Update backend configuration
        console.log("\n🔧 STEP 3: Updating backend configuration...");
        deploymentLog.steps.push({ step: 3, name: "Backend Configuration", startTime: new Date().toISOString() });
        
        const backendResult = updateBackendConfiguration();
        console.log("✅ Backend configuration updated!");
        
        deploymentLog.steps[2].endTime = new Date().toISOString();
        deploymentLog.steps[2].result = "success";
        deploymentLog.steps[2].data = backendResult;
        
        // Step 4: Update frontend configuration
        console.log("\n🌐 STEP 4: Updating frontend configuration...");
        deploymentLog.steps.push({ step: 4, name: "Frontend Configuration", startTime: new Date().toISOString() });
        
        const frontendResult = updateFrontendConfiguration();
        console.log("✅ Frontend configuration updated!");
        
        deploymentLog.steps[3].endTime = new Date().toISOString();
        deploymentLog.steps[3].result = "success";
        deploymentLog.steps[3].data = frontendResult;
        
        // Step 5: Generate comprehensive configurations
        console.log("\n📋 STEP 5: Generating comprehensive configurations...");
        deploymentLog.steps.push({ step: 5, name: "Configuration Generation", startTime: new Date().toISOString() });
        
        const configResult = await generateConfigurations();
        console.log("✅ Comprehensive configurations generated!");
        
        deploymentLog.steps[4].endTime = new Date().toISOString();
        deploymentLog.steps[4].result = "success";
        deploymentLog.steps[4].data = configResult;
        
        // Calculate total time
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        deploymentLog.endTime = new Date().toISOString();
        deploymentLog.totalTimeMs = totalTime;
        deploymentLog.totalTimeFormatted = formatDuration(totalTime);
        deploymentLog.status = "success";
        
        // Save deployment log
        const logsDir = path.join(__dirname, "..", "logs");
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }
        
        const logPath = path.join(logsDir, `mainnet-deployment-${Date.now()}.json`);
        writeFileSync(logPath, JSON.stringify(deploymentLog, null, 2));
        
        // Generate success summary
        console.log("\n🎉 POLYGON MAINNET DEPLOYMENT COMPLETED SUCCESSFULLY!");
        console.log("=" .repeat(60));
        console.log(`⏱️  Total time: ${formatDuration(totalTime)}`);
        console.log(`📄 Deployment log: ${logPath}`);
        
        console.log("\n📋 DEPLOYMENT SUMMARY:");
        console.log(`🔗 NoteRegistry: ${deploymentResult.noteRegistry}`);
        console.log(`🪙 ModuloToken: ${deploymentResult.moduloToken}`);
        console.log(`💰 NoteMonetization: ${deploymentResult.noteMonetization}`);
        
        console.log("\n🔗 VIEW ON POLYGONSCAN:");
        console.log(`📄 NoteRegistry: https://polygonscan.com/address/${deploymentResult.noteRegistry}`);
        console.log(`🪙 ModuloToken: https://polygonscan.com/address/${deploymentResult.moduloToken}`);
        console.log(`💰 NoteMonetization: https://polygonscan.com/address/${deploymentResult.noteMonetization}`);
        
        console.log("\n📁 GENERATED CONFIGURATIONS:");
        console.log("  Backend:");
        console.log("    - backend/src/main/resources/application-mainnet.properties");
        console.log("    - backend/src/main/resources/application-production.properties");
        console.log("    - backend/src/main/resources/docker-mainnet.env");
        console.log("  Frontend:");
        console.log("    - frontend/.env.production");
        console.log("    - frontend/src/config/blockchain-mainnet.json");
        console.log("    - frontend/src/config/mainnet-constants.ts");
        
        console.log("\n🚀 NEXT STEPS:");
        console.log("1. 🔐 Set production private keys and API keys");
        console.log("2. 🗄️  Configure production databases");
        console.log("3. 🧪 Run integration tests on mainnet");
        console.log("4. 🌐 Deploy frontend with production configuration");
        console.log("5. 🔄 Deploy backend with mainnet profile");
        console.log("6. 📊 Monitor contract interactions and gas usage");
        
        if (deploymentLog.warnings.length > 0) {
            console.log("\n⚠️  WARNINGS:");
            deploymentLog.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        
        return {
            success: true,
            deploymentResult,
            backendResult,
            frontendResult,
            configResult,
            deploymentLog
        };
        
    } catch (error) {
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        deploymentLog.endTime = new Date().toISOString();
        deploymentLog.totalTimeMs = totalTime;
        deploymentLog.totalTimeFormatted = formatDuration(totalTime);
        deploymentLog.status = "failed";
        deploymentLog.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        // Save error log
        const logsDir = path.join(__dirname, "..", "logs");
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }
        
        const errorLogPath = path.join(logsDir, `mainnet-deployment-error-${Date.now()}.json`);
        writeFileSync(errorLogPath, JSON.stringify(deploymentLog, null, 2));
        
        console.error("\n❌ POLYGON MAINNET DEPLOYMENT FAILED!");
        console.error("=" .repeat(60));
        console.error(`💥 Error: ${error.message}`);
        console.error(`⏱️  Failed after: ${formatDuration(totalTime)}`);
        console.error(`📄 Error log: ${errorLogPath}`);
        
        throw error;
    }
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Pre-deployment checks
 */
async function preDeploymentChecks() {
    console.log("🔍 Running pre-deployment checks...");
    
    const checks = [];
    
    // Check if we're on the right network
    if (hre.network.name !== "polygon") {
        checks.push("❌ Not connected to Polygon network");
    } else {
        checks.push("✅ Connected to Polygon network");
    }
    
    // Check for required environment variables
    const requiredEnvVars = ["PRIVATE_KEY", "POLYGONSCAN_API_KEY"];
    requiredEnvVars.forEach(envVar => {
        if (process.env[envVar]) {
            checks.push(`✅ ${envVar} is set`);
        } else {
            checks.push(`❌ ${envVar} is missing`);
        }
    });
    
    checks.forEach(check => console.log(check));
    
    const hasErrors = checks.some(check => check.startsWith("❌"));
    if (hasErrors) {
        throw new Error("Pre-deployment checks failed. Please fix the issues above.");
    }
    
    console.log("✅ All pre-deployment checks passed!");
}

// Run deployment if called directly
if (require.main === module) {
    deployAndConfigureMainnet()
        .then((result) => {
            console.log("\n🎊 MAINNET DEPLOYMENT PIPELINE COMPLETED SUCCESSFULLY!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n💥 MAINNET DEPLOYMENT PIPELINE FAILED!");
            console.error("Check the error logs for detailed information.");
            process.exit(1);
        });
}

module.exports = { 
    deployAndConfigureMainnet, 
    preDeploymentChecks,
    formatDuration 
};
