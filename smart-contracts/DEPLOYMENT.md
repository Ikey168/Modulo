# Polygon Mumbai Testnet Deployment Guide

This guide provides step-by-step instructions for deploying the NoteRegistry smart contract to Polygon Mumbai testnet using both Hardhat and Remix IDE.

## 🎯 Prerequisites

### 1. MetaMask Setup
1. Install MetaMask browser extension
2. Add Polygon Mumbai testnet to MetaMask:
   - **Network Name**: Mumbai Testnet
   - **RPC URL**: `https://rpc-mumbai.maticvigil.com/`
   - **Chain ID**: `80001`
   - **Currency Symbol**: `MATIC`
   - **Block Explorer**: `https://mumbai.polygonscan.com/`

### 2. Get Test MATIC
- Visit [Polygon Faucet](https://faucet.polygon.technology/)
- Enter your wallet address
- Request test MATIC tokens (minimum 0.01 MATIC needed)

### 3. API Keys (for Hardhat deployment)
- **Alchemy**: Create account at [alchemy.com](https://alchemy.com) for Mumbai RPC URL
- **PolygonScan**: Get API key at [polygonscan.com](https://polygonscan.com/apis) for contract verification

## 🚀 Method 1: Hardhat Deployment (Recommended)

### Step 1: Environment Setup
1. Navigate to smart-contracts directory:
   ```bash
   cd smart-contracts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Configure `.env` file:
   ```env
   # Mumbai testnet RPC URL
   MUMBAI_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
   
   # Your private key (use a dedicated deployment wallet)
   PRIVATE_KEY=your_private_key_here
   
   # PolygonScan API key for verification
   POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
   ```

### Step 2: Compile Contract
```bash
npm run compile
```

### Step 3: Run Tests (Optional)
```bash
npm run test
```

### Step 4: Deploy to Mumbai
```bash
npm run deploy:mumbai
```

Expected output:
```
🚀 Deploying NoteRegistry to Polygon Mumbai Testnet
====================================================
✅ Connected to Mumbai testnet (Chain ID: 80001)
👤 Deployer: 0x...
💰 Balance: X.XX MATIC
⛽ Current gas price: XX gwei

🔨 Deploying NoteRegistry contract...
📝 Deployment transaction: 0x...
⏳ Waiting for deployment confirmation...

✅ Deployment successful!
====================================================
📍 Contract Address: 0x...
🏷️  Transaction Hash: 0x...
🧱 Block Number: XXXXX
⛽ Gas Used: XXXXX
💰 Cost: X.XX MATIC
🔗 Mumbai PolygonScan: https://mumbai.polygonscan.com/address/0x...
```

### Step 5: Test Contract Interaction
```bash
npm run interact:mumbai
```

### Step 6: Verify Contract (if not done automatically)
```bash
npm run verify:mumbai -- CONTRACT_ADDRESS
```

## 🎨 Method 2: Remix IDE Deployment

### Step 1: Prepare Contract
1. Open [Remix IDE](https://remix.ethereum.org/)
2. Create new file: `NoteRegistry.sol`
3. Copy content from `contracts/NoteRegistry-Remix.sol`

### Step 2: Compile
1. Go to **Solidity Compiler** tab
2. Select compiler version **0.8.19**
3. Click **Compile NoteRegistry.sol**

### Step 3: Deploy
1. Go to **Deploy & Run Transactions** tab
2. **Environment**: Select "Injected Provider - MetaMask"
3. Ensure MetaMask is connected to Mumbai testnet
4. **Contract**: Select "NoteRegistry"
5. Click **Deploy**
6. Confirm transaction in MetaMask

### Step 4: Test Functions
Use Remix interface to test contract functions:

#### Register a Note:
```
registerNote(
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "My First Note"
)
```

#### Verify a Note:
```
verifyNote("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
```

#### Get Total Notes:
```
getTotalNoteCount()
```

## 📊 Deployment Verification

### Check Deployment Status
1. **PolygonScan**: Visit `https://mumbai.polygonscan.com/address/CONTRACT_ADDRESS`
2. **Contract Info**: Verify contract creation and transactions
3. **Code Verification**: Ensure source code is verified (green checkmark)

### Test Contract Functions
```javascript
// Example using ethers.js
const contract = new ethers.Contract(contractAddress, abi, signer);

// Register a note
const tx = await contract.registerNote(noteHash, "Test Note");
await tx.wait();

// Verify note
const [exists, isOwner, isActive] = await contract.verifyNote(noteHash);
console.log(`Note exists: ${exists}, Is owner: ${isOwner}, Is active: ${isActive}`);
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Insufficient Funds
**Error**: "insufficient funds for gas"
**Solution**: Get more test MATIC from the faucet

#### 2. Gas Estimation Failed
**Error**: "cannot estimate gas"
**Solution**: 
- Check contract parameters
- Ensure wallet has enough MATIC
- Try increasing gas limit manually

#### 3. RPC URL Issues
**Error**: "could not detect network"
**Solution**: 
- Verify Mumbai RPC URL in .env
- Try alternative RPC: `https://rpc-mumbai.maticvigil.com/`

#### 4. MetaMask Connection
**Error**: "MetaMask not connected"
**Solution**:
- Refresh page and reconnect MetaMask
- Switch to Mumbai network in MetaMask
- Check if site is connected in MetaMask settings

### Gas Price Optimization
For Mumbai testnet, typical gas settings:
- **Gas Price**: 20-30 gwei
- **Gas Limit**: 2,000,000-3,000,000
- **Estimated Cost**: 0.005-0.01 MATIC

## 📝 Post-Deployment Steps

### 1. Update Configuration
Add contract address to your `.env`:
```env
CONTRACT_ADDRESS_MUMBAI=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

### 2. Update Frontend
Update frontend blockchain service:
```typescript
const CONTRACT_CONFIG = {
  addresses: {
    mumbai: "0xYOUR_DEPLOYED_CONTRACT_ADDRESS",
    // ... other networks
  }
};
```

### 3. Test Integration
1. Connect frontend to Mumbai testnet
2. Test note registration and verification
3. Verify blockchain interactions work correctly

## 🔗 Useful Links

- **Mumbai Faucet**: https://faucet.polygon.technology/
- **PolygonScan Mumbai**: https://mumbai.polygonscan.com/
- **Polygon Documentation**: https://docs.polygon.technology/
- **Remix IDE**: https://remix.ethereum.org/
- **MetaMask**: https://metamask.io/

## 📋 Checklist

- [ ] MetaMask configured with Mumbai testnet
- [ ] Test MATIC obtained from faucet
- [ ] Contract compiled successfully
- [ ] Contract deployed to Mumbai
- [ ] Contract verified on PolygonScan
- [ ] Basic functions tested
- [ ] Frontend configuration updated
- [ ] End-to-end testing completed

## 🎉 Success Criteria

✅ **Smart contract is live & callable on Mumbai testnet**
✅ **Contract interactions work via Remix & Hardhat**
✅ **Note registration and verification functional**
✅ **Contract verified on PolygonScan for transparency**

Your NoteRegistry contract is now deployed and ready for testing on Polygon Mumbai testnet!
