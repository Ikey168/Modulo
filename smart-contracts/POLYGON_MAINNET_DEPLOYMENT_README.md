# Polygon Mainnet Deployment Guide

This guide provides comprehensive instructions for deploying the Modulo smart contract suite to Polygon Mainnet and configuring all system components.

## 📋 Overview

The Modulo project consists of three main smart contracts:
- **NoteRegistry**: Core note storage and verification system
- **ModuloToken**: ERC20 governance token for the ecosystem
- **NoteMonetization**: Monetization and reward distribution system

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │    Backend       │    │  Smart Contracts   │
│   (React)       │◄──►│  (Spring Boot)   │◄──►│   (Solidity)       │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Web3 Provider  │    │   Database       │    │  Polygon Mainnet    │
│   (MetaMask)    │    │  (PostgreSQL)    │    │    (Ethereum)       │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18 or higher)
2. **MATIC tokens** for gas fees (minimum 10 MATIC recommended)
3. **PolygonScan API Key** for contract verification
4. **Private key** with deployment permissions

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configurations
PRIVATE_KEY=your_private_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
INFURA_PROJECT_ID=your_infura_project_id_here
```

### One-Command Deployment

```bash
# Run the complete deployment pipeline
npm run deploy:mainnet:full

# Or using yarn
yarn deploy:mainnet:full

# Or directly with Node.js
node scripts/deploy-mainnet-pipeline.js
```

## 📝 Deployment Scripts

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-polygon-mainnet.js` | Deploy contracts to mainnet | `node scripts/deploy-polygon-mainnet.js` |
| `verify-polygon-mainnet.js` | Verify contracts on PolygonScan | `node scripts/verify-polygon-mainnet.js` |
| `update-backend-config.js` | Generate backend configurations | `node scripts/update-backend-config.js` |
| `update-frontend-config.js` | Generate frontend configurations | `node scripts/update-frontend-config.js` |
| `generate-configs.js` | Generate all configurations | `node scripts/generate-configs.js` |
| `deploy-mainnet-pipeline.js` | **Master script - runs everything** | `node scripts/deploy-mainnet-pipeline.js` |

### Configuration Scripts

| Script | Output | Description |
|--------|--------|-------------|
| `config-manager.js` | Various configs | Configuration management utility |
| Backend configs | `application-*.properties` | Spring Boot profile configurations |
| Frontend configs | Environment files | React Web3 integration files |
| Docker configs | `docker-*.env` | Containerized deployment configs |

## 🔧 Manual Deployment Steps

If you prefer to run each step manually:

### Step 1: Deploy Contracts

```bash
# Deploy all contracts to Polygon Mainnet
npx hardhat run scripts/deploy-polygon-mainnet.js --network polygon

# Expected output:
# ✅ NoteRegistry deployed to: 0x...
# ✅ ModuloToken deployed to: 0x...
# ✅ NoteMonetization deployed to: 0x...
```

### Step 2: Verify Contracts

```bash
# Verify all deployed contracts
node scripts/verify-polygon-mainnet.js

# Expected output:
# ✅ NoteRegistry verified on PolygonScan
# ✅ ModuloToken verified on PolygonScan
# ✅ NoteMonetization verified on PolygonScan
```

### Step 3: Update Backend Configuration

```bash
# Generate backend configuration files
node scripts/update-backend-config.js

# Generated files:
# - backend/src/main/resources/application-mainnet.properties
# - backend/src/main/resources/application-production.properties
# - backend/src/main/resources/docker-mainnet.env
```

### Step 4: Update Frontend Configuration

```bash
# Generate frontend configuration files
node scripts/update-frontend-config.js

# Generated files:
# - frontend/.env.production
# - frontend/src/config/blockchain-mainnet.json
# - frontend/src/config/mainnet-constants.ts
# - frontend/src/utils/wallet-mainnet.ts
```

### Step 5: Generate Comprehensive Configs

```bash
# Generate additional configuration files and documentation
node scripts/generate-configs.js

# Generated files:
# - deployments/polygon-mainnet-deployment.json
# - deployments/MAINNET_DEPLOYMENT_GUIDE.md
# - deployments/mainnet-abis.json
```

## 📊 Deployment Costs

Estimated gas costs for Polygon Mainnet deployment:

| Contract | Gas Limit | Estimated Cost (MATIC) |
|----------|-----------|------------------------|
| NoteRegistry | ~3,000,000 | ~2.5 MATIC |
| ModuloToken | ~2,500,000 | ~2.0 MATIC |
| NoteMonetization | ~3,500,000 | ~3.0 MATIC |
| **Total** | **~9,000,000** | **~7.5 MATIC** |

*Costs may vary based on current gas prices*

## 🔐 Security Considerations

### Private Key Management
- **Never commit private keys to version control**
- Use environment variables or secure key management systems
- Consider using hardware wallets for production deployments
- Rotate keys regularly and use different keys for different environments

### Contract Security
- All contracts have been audited for common vulnerabilities
- Use multi-signature wallets for contract administration
- Implement timelock mechanisms for critical updates
- Monitor contract interactions for unusual activity

### Network Security
- Use HTTPS endpoints for all RPC connections
- Validate all transaction parameters before signing
- Implement proper error handling and rollback mechanisms
- Monitor for front-running and MEV attacks

## 🧪 Testing

### Pre-Deployment Testing

```bash
# Run comprehensive test suite
npm test

# Run integration tests
npm run test:integration

# Run deployment simulation on testnet
npm run deploy:testnet
```

### Post-Deployment Verification

```bash
# Verify contract functionality
npm run verify:mainnet

# Test backend integration
npm run test:backend:mainnet

# Test frontend integration
npm run test:frontend:mainnet
```

## 📈 Monitoring

### Contract Monitoring

1. **PolygonScan**: Monitor transactions and contract state
2. **Defender**: Automated monitoring and alerting
3. **Custom Scripts**: Monitor specific events and metrics

### Application Monitoring

1. **Backend**: Spring Boot Actuator + Prometheus
2. **Frontend**: Web3 connection status and transaction monitoring
3. **Database**: PostgreSQL performance and data integrity

## 🔄 Deployment Profiles

### Environment Configurations

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| `development` | Local development | Local blockchain, test tokens |
| `testnet` | Integration testing | Polygon Mumbai, test MATIC |
| `staging` | Pre-production testing | Polygon Mainnet, limited access |
| `production` | Live application | Polygon Mainnet, full features |

### Configuration Files

```bash
# Backend configurations
backend/src/main/resources/
├── application.properties              # Base configuration
├── application-development.properties  # Local development
├── application-testnet.properties     # Mumbai testnet
├── application-staging.properties     # Staging environment
├── application-production.properties  # Production mainnet
└── application-mainnet.properties     # Mainnet-specific

# Frontend configurations
frontend/
├── .env.development                    # Local development
├── .env.testnet                       # Mumbai testnet
├── .env.staging                       # Staging environment
└── .env.production                    # Production mainnet
```

## 📱 Mobile Integration

The deployment also configures mobile app integration:

### React Native Configuration

```javascript
// mobile/src/config/blockchain.js
export const MAINNET_CONFIG = {
  chainId: 137,
  rpcUrl: 'https://polygon-rpc.com',
  contracts: {
    noteRegistry: '0x...',
    moduloToken: '0x...',
    noteMonetization: '0x...'
  }
};
```

### Mobile Wallet Integration

- **MetaMask Mobile**: Automatic network detection
- **WalletConnect**: Cross-platform wallet support
- **Trust Wallet**: Direct integration support
- **Coinbase Wallet**: dApp browser compatibility

## 🚨 Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check network connection
npx hardhat run scripts/check-network.js --network polygon

# Verify account balance
npx hardhat run scripts/check-balance.js --network polygon

# Test gas estimation
npx hardhat run scripts/estimate-gas.js --network polygon
```

#### Verification Failures
```bash
# Manual verification
npx hardhat verify --network polygon CONTRACT_ADDRESS "CONSTRUCTOR_ARG1"

# Check verification status
node scripts/check-verification.js
```

#### Configuration Issues
```bash
# Validate configurations
node scripts/validate-configs.js

# Reset configurations
node scripts/reset-configs.js
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `INSUFFICIENT_FUNDS` | Not enough MATIC for gas | Add more MATIC to deployment account |
| `NETWORK_ERROR` | RPC connection issues | Check network configuration and endpoints |
| `VERIFICATION_FAILED` | PolygonScan verification error | Wait and retry, check API key |
| `CONFIG_ERROR` | Configuration file issues | Validate configuration syntax and values |

## 🔗 Useful Links

- **Polygon Network**: https://polygon.technology/
- **PolygonScan**: https://polygonscan.com/
- **Hardhat Documentation**: https://hardhat.org/docs
- **Web3.js Documentation**: https://web3js.readthedocs.io/
- **MetaMask Developer Docs**: https://docs.metamask.io/

## 📞 Support

For deployment support and questions:

1. **Documentation**: Check this README and deployment logs
2. **GitHub Issues**: Create an issue with deployment details
3. **Community**: Join our Discord for real-time support
4. **Email**: support@modulo.app for critical deployment issues

---

## 🎉 Deployment Checklist

### Pre-Deployment ✅
- [ ] Environment variables configured
- [ ] Private key secured and funded
- [ ] PolygonScan API key obtained
- [ ] All tests passing
- [ ] Contracts audited

### Deployment ✅
- [ ] Contracts deployed successfully
- [ ] Contracts verified on PolygonScan
- [ ] Backend configuration updated
- [ ] Frontend configuration updated
- [ ] Deployment documentation generated

### Post-Deployment ✅
- [ ] Contract functionality tested
- [ ] Backend integration verified
- [ ] Frontend Web3 connection working
- [ ] Mobile app configuration updated
- [ ] Monitoring systems activated
- [ ] Team notified of deployment

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Author**: Modulo Development Team
