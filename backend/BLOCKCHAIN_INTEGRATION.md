# Blockchain Integration - Spring Boot Backend (PLACEHOLDER)

This document outlines the planned blockchain integration for the Modulo application using web3j to interact with smart contracts on the Polygon network.

## ⚠️ Current Status: PLACEHOLDER IMPLEMENTATION

The blockchain integration is currently in placeholder status due to compatibility issues between web3j versions and Java 11.

### Issues Encountered

1. **Java Version Compatibility**: 
   - web3j 4.10.x requires Java 17 (class file version 61.0)
   - Current project uses Java 11 (class file version 55.0)
   - web3j 4.8.x and earlier should support Java 11 but need testing

2. **Maven Plugin Compatibility**:
   - web3j-maven-plugin has similar Java version requirements
   - Contract wrapper generation requires alternative approach

### Planned Implementation

The full blockchain integration would provide:

#### Features
- **Note Registration**: Register note hashes on Polygon blockchain for integrity verification
- **Note Verification**: Verify note existence and ownership on-chain
- **Transaction Management**: Handle blockchain transactions asynchronously
- **Network Monitoring**: Check blockchain connectivity and status
- **Gas Management**: Optimize transaction costs and retry logic

#### Architecture
- **BlockchainService**: Core service for smart contract interaction
- **BlockchainController**: REST API endpoints for blockchain operations
- **BlockchainConfig**: Web3j client and network configuration
- **Contract Wrappers**: Java interfaces for NoteRegistry smart contract

### Configuration Required

```properties
# Blockchain Network Configuration
blockchain.network.rpc-url=https://rpc-mumbai.maticvigil.com
blockchain.network.chain-id=80001
blockchain.network.name=mumbai

# Smart Contract Configuration
blockchain.contract.address=${SMART_CONTRACT_ADDRESS}
blockchain.private-key=${PRIVATE_KEY}

# Gas Configuration
blockchain.gas.price=20000000000
blockchain.gas.limit=3000000
```

### Environment Variables

- `SMART_CONTRACT_ADDRESS`: Deployed NoteRegistry contract address on Mumbai testnet
- `PRIVATE_KEY`: Private key for transaction signing (must have MATIC funds)

### API Endpoints (Planned)

- `POST /api/blockchain/notes/register` - Register note on blockchain
- `POST /api/blockchain/notes/verify` - Verify note existence
- `GET /api/blockchain/notes/{id}` - Get note details
- `GET /api/blockchain/notes/my-notes` - Get user's notes
- `GET /api/blockchain/status` - Network connectivity status

### Dependencies (When Implemented)

```xml
<!-- Web3j dependencies (Java 11 compatible version) -->
<dependency>
    <groupId>org.web3j</groupId>
    <artifactId>core</artifactId>
    <version>4.8.7</version>
</dependency>
<dependency>
    <groupId>org.web3j</groupId>
    <artifactId>crypto</artifactId>
    <version>4.8.7</version>
</dependency>
```

### Next Steps

1. **Resolve Compatibility Issues**:
   - Test web3j 4.8.x with Java 11
   - Alternative: Upgrade project to Java 17
   - Alternative: Use HTTP calls to blockchain RPC

2. **Deploy Smart Contract**:
   - Deploy NoteRegistry contract to Polygon Mumbai
   - Verify contract on PolygonScan
   - Fund deployer account with MATIC

3. **Generate Contract Wrappers**:
   - Use web3j CLI tools instead of Maven plugin
   - Manually create contract interfaces
   - Test contract interaction

4. **Implement Service Layer**:
   - Complete BlockchainService implementation
   - Add async transaction handling
   - Implement error handling and retries

5. **Create API Layer**:
   - Implement BlockchainController
   - Add input validation
   - Create comprehensive tests

6. **Integration Testing**:
   - Test with Mumbai testnet
   - Load testing with multiple transactions
   - Error scenario testing

### Alternative Implementations

If web3j compatibility cannot be resolved:

1. **Direct HTTP/RPC Calls**: Use Spring WebClient to call blockchain RPC methods
2. **Microservice Architecture**: Separate blockchain service with compatible Java version
3. **Ethereum Libraries**: Use other Java Ethereum libraries like EthereumJ

### Current Placeholder Service

The current implementation includes:
- `BlockchainService` with placeholder methods
- Proper logging for future implementation tracking
- Documentation of intended functionality

This ensures the application compiles and runs while blockchain integration is pending.

### Related Work

- **Issue #34**: ✅ Polygon Mumbai deployment infrastructure (completed)
- **Issue #35**: 🟡 Spring Boot blockchain integration (in progress)
- **Smart Contracts**: NoteRegistry.sol implemented and ready for deployment
