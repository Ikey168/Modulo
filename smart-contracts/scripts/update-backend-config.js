const { readFileSync, writeFileSync, existsSync } = require("fs");
const path = require("path");

/**
 * Update backend configuration for Polygon mainnet
 */
function updateBackendConfiguration() {
    console.log("🔧 Updating backend configuration for Polygon mainnet...");
    
    // Read mainnet deployment info
    const deploymentPath = path.join(__dirname, "..", "deployments", "polygon-mainnet.json");
    
    if (!existsSync(deploymentPath)) {
        throw new Error("❌ Mainnet deployment not found. Deploy contracts first.");
    }
    
    const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
    const contracts = deployment.contracts;
    
    console.log("📋 Found contract addresses:");
    console.log(`🔗 NoteRegistry: ${contracts.noteRegistryOptimized.address}`);
    console.log(`🪙 ModuloToken: ${contracts.moduloTokenOptimized.address}`);
    console.log(`💰 NoteMonetization: ${contracts.noteMonetization.address}`);
    
    // Define the mainnet configuration
    const mainnetConfig = `
# Polygon Mainnet Blockchain Configuration - Updated ${new Date().toISOString()}
blockchain.network.rpc-url=https://polygon-rpc.com/
blockchain.network.chain-id=137
blockchain.network.name=polygon-mainnet
blockchain.contract.note-registry-address=${contracts.noteRegistryOptimized.address}
blockchain.contract.modulo-token-address=${contracts.moduloTokenOptimized.address}
blockchain.contract.note-monetization-address=${contracts.noteMonetization.address}
blockchain.private-key=\${BLOCKCHAIN_PRIVATE_KEY:your-mainnet-private-key-here}
blockchain.gas.price=50000000000
blockchain.gas.limit=500000

# Polygon Mainnet Web3 Settings
blockchain.web3.confirmations=3
blockchain.web3.timeout=60000
blockchain.web3.retry-attempts=3
blockchain.web3.max-fee-per-gas=50000000000
blockchain.web3.max-priority-fee-per-gas=2000000000

# Mainnet Feature Flags
modulo.features.blockchain.enabled=true
modulo.features.note-verification=true
modulo.features.token-rewards=true
modulo.features.note-monetization=true
`;

    // Create mainnet-specific properties file
    const backendDir = path.join(__dirname, "..", "..", "backend", "src", "main", "resources");
    const mainnetPropertiesPath = path.join(backendDir, "application-mainnet.properties");
    
    // Read the base application.properties to get other configurations
    const basePropertiesPath = path.join(backendDir, "application.properties");
    let baseProperties = "";
    
    if (existsSync(basePropertiesPath)) {
        baseProperties = readFileSync(basePropertiesPath, "utf8");
        
        // Remove the local blockchain configuration section
        baseProperties = baseProperties.replace(
            /# Blockchain Configuration[\s\S]*?blockchain\.gas\.limit=\d+/,
            mainnetConfig.trim()
        );
    } else {
        baseProperties = mainnetConfig.trim();
    }
    
    writeFileSync(mainnetPropertiesPath, baseProperties);
    console.log(`💾 Mainnet configuration saved to: ${mainnetPropertiesPath}`);
    
    // Create environment-specific configurations
    const environments = {
        "production": {
            file: "application-production.properties",
            config: `
# Production Environment Configuration
spring.profiles.active=production

# Production Database (Use your actual production database)
spring.datasource.url=\${DATABASE_URL:jdbc:postgresql://localhost:5432/modulo_prod}
spring.datasource.username=\${DATABASE_USERNAME:modulo_user}
spring.datasource.password=\${DATABASE_PASSWORD:your_password}

# Production Security
server.ssl.enabled=true
server.port=8443

# Production Blockchain - Polygon Mainnet
${mainnetConfig.trim()}

# Production Logging
logging.level.com.modulo=INFO
logging.level.root=WARN
`
        },
        "staging": {
            file: "application-staging.properties", 
            config: `
# Staging Environment Configuration  
spring.profiles.active=staging

# Staging Database
spring.datasource.url=\${DATABASE_URL:jdbc:postgresql://localhost:5432/modulo_staging}
spring.datasource.username=\${DATABASE_USERNAME:modulo_staging}
spring.datasource.password=\${DATABASE_PASSWORD:staging_password}

# Staging Blockchain - Polygon Mainnet (for final testing)
${mainnetConfig.trim()}

# Staging Logging
logging.level.com.modulo=DEBUG
logging.level.blockchain=DEBUG
`
        }
    };
    
    Object.entries(environments).forEach(([env, config]) => {
        const envPath = path.join(backendDir, config.file);
        writeFileSync(envPath, config.config.trim());
        console.log(`💾 ${env} configuration saved to: ${envPath}`);
    });
    
    // Create Docker environment file
    const dockerEnv = `# Polygon Mainnet Docker Configuration
# Copy this to your .env file for Docker deployment

# Database
DATABASE_URL=jdbc:postgresql://db:5432/modulo
DATABASE_USERNAME=modulo_user
DATABASE_PASSWORD=secure_password_here

# Blockchain - Polygon Mainnet
BLOCKCHAIN_PRIVATE_KEY=your_mainnet_private_key_here
BLOCKCHAIN_NETWORK=polygon-mainnet
POLYGON_RPC_URL=https://polygon-rpc.com/

# Contract Addresses
NOTE_REGISTRY_ADDRESS=${contracts.noteRegistryOptimized.address}
MODULO_TOKEN_ADDRESS=${contracts.moduloTokenOptimized.address}
NOTE_MONETIZATION_ADDRESS=${contracts.noteMonetization.address}

# Security
JWT_SECRET=your_jwt_secret_here
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret

# Features
MODULO_BLOCKCHAIN_ENABLED=true
MODULO_NOTE_VERIFICATION_ENABLED=true
MODULO_TOKEN_REWARDS_ENABLED=true
MODULO_NOTE_MONETIZATION_ENABLED=true
`;
    
    const dockerEnvPath = path.join(backendDir, "docker-mainnet.env");
    writeFileSync(dockerEnvPath, dockerEnv);
    console.log(`🐳 Docker environment saved to: ${dockerEnvPath}`);
    
    console.log("\n✅ Backend configuration updated for Polygon mainnet!");
    console.log("\n🔄 Next steps:");
    console.log("1. 🔐 Set BLOCKCHAIN_PRIVATE_KEY environment variable");
    console.log("2. 🗄️  Update database configuration for production");
    console.log("3. 🔒 Configure SSL certificates");
    console.log("4. 🧪 Run integration tests");
    console.log("5. 🚀 Deploy with: --spring.profiles.active=mainnet");
    
    return {
        contracts: {
            noteRegistry: contracts.noteRegistryOptimized.address,
            moduloToken: contracts.moduloTokenOptimized.address,
            noteMonetization: contracts.noteMonetization.address
        },
        network: "polygon-mainnet",
        chainId: 137
    };
}

module.exports = { updateBackendConfiguration };

// Run if called directly
if (require.main === module) {
    try {
        const result = updateBackendConfiguration();
        console.log("\n🎉 Backend configuration update completed!");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Backend configuration update failed:", error.message);
        process.exit(1);
    }
}
