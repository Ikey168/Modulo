const { MainnetConfigManager } = require("./config-manager");

/**
 * Generate configurations for backend and frontend after mainnet deployment
 */
async function generateConfigurations() {
    console.log("🔧 Generating mainnet configurations...");
    
    try {
        const configManager = new MainnetConfigManager();
        
        // Check if deployment exists
        console.log("📋 Checking deployment status...");
        const addresses = configManager.getMainnetAddresses();
        
        console.log("✅ Found mainnet deployment:");
        console.log(`🔗 NoteRegistry: ${addresses.noteRegistry}`);
        console.log(`🪙 ModuloToken: ${addresses.moduloToken}`);
        console.log(`💰 NoteMonetization: ${addresses.noteMonetization}`);
        
        // Generate backend configuration
        console.log("\n🔧 Generating backend configuration...");
        const backendConfig = configManager.generateBackendConfig();
        
        // Generate frontend configuration  
        console.log("\n🌐 Generating frontend configuration...");
        const frontendConfig = configManager.generateFrontendConfig();
        
        // Generate deployment summary
        console.log("\n📄 Generating deployment summary...");
        const summary = configManager.generateDeploymentSummary();
        
        console.log("\n🎉 CONFIGURATION GENERATION COMPLETED!");
        console.log("=" .repeat(60));
        console.log("📁 Generated files:");
        console.log("  - config/mainnet-backend.json");
        console.log("  - config/mainnet-frontend.json");
        console.log("  - config/mainnet.env");
        console.log("  - config/deployment-summary.json");
        console.log("  - config/DEPLOYMENT_REPORT.md");
        
        console.log("\n🔄 Next steps:");
        console.log("1. 📋 Review the deployment report");
        console.log("2. 🔧 Update backend with new contract addresses");
        console.log("3. 🌐 Update frontend with new configuration");
        console.log("4. 🧪 Run integration tests");
        console.log("5. 🚀 Deploy to production");
        
        return {
            backendConfig,
            frontendConfig,
            summary
        };
        
    } catch (error) {
        console.error("❌ Configuration generation failed:", error.message);
        throw error;
    }
}

// Run configuration generation if called directly
if (require.main === module) {
    generateConfigurations()
        .then(() => {
            console.log("\n✨ All configurations generated successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 CONFIGURATION FAILED:", error);
            process.exit(1);
        });
}

module.exports = { generateConfigurations };
