const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const path = require("path");

/**
 * Update frontend configuration for Polygon mainnet
 */
function updateFrontendConfiguration() {
    console.log("🌐 Updating frontend configuration for Polygon mainnet...");
    
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
    
    // Define the mainnet frontend configuration
    const frontendDir = path.join(__dirname, "..", "..", "frontend");
    
    // Create config directory if it doesn't exist
    const configDir = path.join(frontendDir, "src", "config");
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    
    // 1. Create mainnet blockchain config
    const blockchainConfig = {
        network: {
            name: "Polygon Mainnet",
            chainId: 137,
            chainIdHex: "0x89",
            rpcUrl: "https://polygon-rpc.com/",
            blockExplorer: "https://polygonscan.com",
            nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC",
                decimals: 18
            }
        },
        contracts: {
            noteRegistry: {
                address: contracts.noteRegistryOptimized.address,
                deployed: contracts.noteRegistryOptimized.blockNumber
            },
            moduloToken: {
                address: contracts.moduloTokenOptimized.address,
                deployed: contracts.moduloTokenOptimized.blockNumber
            },
            noteMonetization: {
                address: contracts.noteMonetization.address,
                deployed: contracts.noteMonetization.blockNumber
            }
        },
        features: {
            noteVerification: true,
            tokenRewards: true,
            noteMonetization: true,
            decentralizedStorage: true,
            smartContractInteraction: true
        },
        gasSettings: {
            maxFeePerGas: "50000000000", // 50 gwei
            maxPriorityFeePerGas: "2000000000", // 2 gwei
            gasLimit: "500000"
        },
        metadata: {
            deployedAt: deployment.timestamp,
            deployer: deployment.deployer,
            network: "polygon-mainnet",
            version: "1.0.0"
        }
    };
    
    const blockchainConfigPath = path.join(configDir, "blockchain-mainnet.json");
    writeFileSync(blockchainConfigPath, JSON.stringify(blockchainConfig, null, 2));
    console.log(`💾 Blockchain config saved to: ${blockchainConfigPath}`);
    
    // 2. Create environment configuration
    const envConfig = `# Polygon Mainnet Configuration for Frontend
# Copy this to .env.production in your frontend directory

# Blockchain Network
REACT_APP_BLOCKCHAIN_NETWORK=polygon-mainnet
REACT_APP_CHAIN_ID=137
REACT_APP_CHAIN_ID_HEX=0x89
REACT_APP_RPC_URL=https://polygon-rpc.com/
REACT_APP_BLOCK_EXPLORER=https://polygonscan.com

# Contract Addresses - Updated ${new Date().toISOString()}
REACT_APP_NOTE_REGISTRY_ADDRESS=${contracts.noteRegistryOptimized.address}
REACT_APP_MODULO_TOKEN_ADDRESS=${contracts.moduloTokenOptimized.address}
REACT_APP_NOTE_MONETIZATION_ADDRESS=${contracts.noteMonetization.address}

# Feature Flags
REACT_APP_ENABLE_BLOCKCHAIN=true
REACT_APP_ENABLE_NOTE_VERIFICATION=true
REACT_APP_ENABLE_TOKEN_REWARDS=true
REACT_APP_ENABLE_NOTE_MONETIZATION=true

# Web3 Configuration
REACT_APP_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
REACT_APP_INFURA_PROJECT_ID=your_infura_project_id_optional

# API Configuration
REACT_APP_API_BASE_URL=https://api.modulo.app
REACT_APP_BACKEND_URL=https://backend.modulo.app

# UI Configuration
REACT_APP_THEME=mainnet
REACT_APP_SHOW_TESTNET_WARNING=false
REACT_APP_ENABLE_DEV_TOOLS=false
`;
    
    const envPath = path.join(frontendDir, ".env.production");
    writeFileSync(envPath, envConfig);
    console.log(`💾 Production environment saved to: ${envPath}`);
    
    // 3. Create mainnet constants file
    const constantsFile = `// Polygon Mainnet Constants - Auto-generated
export const MAINNET_CONFIG = {
  NETWORK_NAME: 'Polygon Mainnet',
  CHAIN_ID: 137,
  CHAIN_ID_HEX: '0x89',
  RPC_URL: 'https://polygon-rpc.com/',
  BLOCK_EXPLORER: 'https://polygonscan.com',
  
  CONTRACTS: {
    NOTE_REGISTRY: '${contracts.noteRegistryOptimized.address}',
    MODULO_TOKEN: '${contracts.moduloTokenOptimized.address}',
    NOTE_MONETIZATION: '${contracts.noteMonetization.address}',
  },
  
  NATIVE_CURRENCY: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  
  FEATURES: {
    NOTE_VERIFICATION: true,
    TOKEN_REWARDS: true,
    NOTE_MONETIZATION: true,
    DECENTRALIZED_STORAGE: true,
  },
  
  GAS_SETTINGS: {
    MAX_FEE_PER_GAS: '50000000000', // 50 gwei
    MAX_PRIORITY_FEE_PER_GAS: '2000000000', // 2 gwei
    GAS_LIMIT: '500000',
  },
  
  DEPLOYMENT_INFO: {
    DEPLOYED_AT: '${deployment.timestamp}',
    DEPLOYER: '${deployment.deployer}',
    VERSION: '1.0.0',
  }
} as const;

// Network switching helper
export const switchToPolygonMainnet = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Try to switch to Polygon network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MAINNET_CONFIG.CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: MAINNET_CONFIG.CHAIN_ID_HEX,
          chainName: MAINNET_CONFIG.NETWORK_NAME,
          rpcUrls: [MAINNET_CONFIG.RPC_URL],
          nativeCurrency: MAINNET_CONFIG.NATIVE_CURRENCY,
          blockExplorerUrls: [MAINNET_CONFIG.BLOCK_EXPLORER],
        }],
      });
    } else {
      throw switchError;
    }
  }
};

// Contract address getters with validation
export const getContractAddress = (contractName: keyof typeof MAINNET_CONFIG.CONTRACTS): string => {
  const address = MAINNET_CONFIG.CONTRACTS[contractName];
  if (!address || address === '0x') {
    throw new Error(\`Contract address not found: \${contractName}\`);
  }
  return address;
};

// Environment validation
export const validateMainnetEnvironment = () => {
  const requiredEnvVars = [
    'REACT_APP_NOTE_REGISTRY_ADDRESS',
    'REACT_APP_MODULO_TOKEN_ADDRESS', 
    'REACT_APP_NOTE_MONETIZATION_ADDRESS',
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
  }
};

export default MAINNET_CONFIG;
`;
    
    const constantsPath = path.join(configDir, "mainnet-constants.ts");
    writeFileSync(constantsPath, constantsFile);
    console.log(`💾 Constants file saved to: ${constantsPath}`);
    
    // 4. Create wallet configuration
    const walletConfig = {
        supportedWallets: [
            "MetaMask",
            "WalletConnect", 
            "Coinbase Wallet",
            "Rainbow",
            "Trust Wallet"
        ],
        defaultWallet: "MetaMask",
        walletConnectProjectId: "your_project_id_here",
        networkConfig: {
            chainId: 137,
            chainName: "Polygon Mainnet",
            rpcUrls: ["https://polygon-rpc.com/"],
            blockExplorerUrls: ["https://polygonscan.com"],
            nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC", 
                decimals: 18
            }
        }
    };
    
    const walletConfigPath = path.join(configDir, "wallet-mainnet.json");
    writeFileSync(walletConfigPath, JSON.stringify(walletConfig, null, 2));
    console.log(`💾 Wallet config saved to: ${walletConfigPath}`);
    
    // 5. Create deployment summary for frontend team
    const frontendSummary = `# Polygon Mainnet Deployment - Frontend Integration

## 🚀 Contract Addresses

| Contract | Address | Purpose |
|----------|---------|---------|
| NoteRegistry | \`${contracts.noteRegistryOptimized.address}\` | Note verification & ownership |
| ModuloToken | \`${contracts.moduloTokenOptimized.address}\` | Platform utility token |
| NoteMonetization | \`${contracts.noteMonetization.address}\` | Advanced monetization features |

## 🔧 Frontend Setup

### 1. Environment Configuration
Copy \`.env.production\` to your environment and update values:
\`\`\`bash
cp .env.production .env.local
# Update API URLs and keys
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install @web3-react/core @web3-react/injected-connector ethers
\`\`\`

### 3. Import Configuration
\`\`\`typescript
import { MAINNET_CONFIG } from './config/mainnet-constants';
import { switchToPolygonMainnet } from './config/mainnet-constants';
\`\`\`

## 📱 Wallet Integration

### MetaMask Network Addition
\`\`\`javascript
await switchToPolygonMainnet();
\`\`\`

### Contract Interaction Example
\`\`\`typescript
import { ethers } from 'ethers';
import { MAINNET_CONFIG } from './config/mainnet-constants';

const provider = new ethers.providers.Web3Provider(window.ethereum);
const noteRegistry = new ethers.Contract(
  MAINNET_CONFIG.CONTRACTS.NOTE_REGISTRY,
  noteRegistryABI,
  provider.getSigner()
);
\`\`\`

## 🧪 Testing

1. Test on Polygon mainnet with small amounts
2. Verify all contract interactions work correctly
3. Test wallet connection and network switching
4. Validate gas estimation and transaction signing

## 🔒 Security Notes

- Never hardcode private keys in frontend code
- Validate all user inputs before blockchain interactions
- Use proper error handling for failed transactions
- Implement transaction confirmation flows

---
*Deployment completed on ${new Date().toISOString()}*
`;
    
    const summaryPath = path.join(configDir, "MAINNET_DEPLOYMENT.md");
    writeFileSync(summaryPath, frontendSummary);
    console.log(`📋 Frontend summary saved to: ${summaryPath}`);
    
    console.log("\n✅ Frontend configuration updated for Polygon mainnet!");
    console.log("\n📁 Generated files:");
    console.log(`  - ${path.relative(process.cwd(), blockchainConfigPath)}`);
    console.log(`  - ${path.relative(process.cwd(), envPath)}`);
    console.log(`  - ${path.relative(process.cwd(), constantsPath)}`);
    console.log(`  - ${path.relative(process.cwd(), walletConfigPath)}`);
    console.log(`  - ${path.relative(process.cwd(), summaryPath)}`);
    
    console.log("\n🔄 Next steps:");
    console.log("1. 🔧 Update API URLs in .env.production");
    console.log("2. 🔑 Add WalletConnect project ID");
    console.log("3. 🧪 Test wallet connection on mainnet");
    console.log("4. 🚀 Deploy frontend with production build");
    
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

module.exports = { updateFrontendConfiguration };

// Run if called directly
if (require.main === module) {
    try {
        const result = updateFrontendConfiguration();
        console.log("\n🎉 Frontend configuration update completed!");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Frontend configuration update failed:", error.message);
        process.exit(1);
    }
}
