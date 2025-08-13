# Blockchain Integration - Spring Boot Backend

This module provides blockchain integration for the Modulo application, enabling note registration and verification on the Polygon network using web3j.

## Overview

The blockchain integration allows users to:
- Register notes on the blockchain for integrity verification
- Verify note existence and ownership
- Update note content (owner only)
- Query blockchain state and statistics

## Architecture

### Components

1. **BlockchainConfig** - Web3j configuration and bean definitions
2. **BlockchainService** - Core blockchain interaction service
3. **BlockchainController** - REST API endpoints
4. **AsyncConfig** - Asynchronous processing configuration

### Dependencies

- **web3j-core (4.10.3)** - Ethereum/Polygon blockchain interaction
- **web3j-crypto (4.10.3)** - Cryptographic operations
- **web3j-utils (4.10.3)** - Utility functions
- **web3j-contracts (4.10.3)** - Smart contract interaction

## Configuration

### Application Properties

```properties
# Blockchain Configuration
blockchain.network.rpc-url=https://rpc-mumbai.maticvigil.com
blockchain.network.chain-id=80001
blockchain.contract.address=${SMART_CONTRACT_ADDRESS}
blockchain.private-key=${PRIVATE_KEY}

# Gas Configuration
blockchain.gas.price=20000000000
blockchain.gas.limit=3000000
```

### Environment Variables

- `SMART_CONTRACT_ADDRESS` - Deployed NoteRegistry contract address
- `PRIVATE_KEY` - Private key for transaction signing (should be funded with MATIC)

## API Endpoints

### Network Status
```
GET /api/blockchain/status
```
Returns blockchain connectivity and network information.

### Note Registration
```
POST /api/blockchain/notes/register
Content-Type: application/json

{
  "content": "Note content to register",
  "title": "Note title"
}
```

### Note Verification
```
POST /api/blockchain/notes/verify
Content-Type: application/json

{
  "content": "Note content to verify"
}
```

### Note Details
```
GET /api/blockchain/notes/{noteId}
```

### User Notes
```
GET /api/blockchain/notes/my-notes
```

### Note Count
```
GET /api/blockchain/notes/count
```

### Update Note
```
PUT /api/blockchain/notes/{noteId}
Content-Type: application/json

{
  "newContent": "Updated note content"
}
```

### Generate Hash
```
POST /api/blockchain/hash
Content-Type: application/json

{
  "content": "Content to hash"
}
```

## Smart Contract Integration

The service integrates with the NoteRegistry smart contract deployed on Polygon Mumbai testnet. The contract provides:

- `registerNote(bytes32 contentHash, string title)` - Register a new note
- `verifyNote(bytes32 contentHash)` - Verify note existence
- `getNoteById(uint256 noteId)` - Get note details
- `updateNote(uint256 noteId, bytes32 newContentHash)` - Update note content
- `getNotesOwnedBy(address owner)` - Get notes by owner
- `getTotalNoteCount()` - Get total note count

## Testing

### Unit Tests
```bash
mvn test -Dtest=BlockchainControllerTest
```

### Integration Tests
```bash
# Requires network connectivity to Polygon Mumbai
mvn test -Dtest=BlockchainServiceIntegrationTest
```

## Security Considerations

1. **Private Key Management**: Never commit private keys to version control
2. **Rate Limiting**: Implement rate limiting for blockchain operations
3. **Input Validation**: All user inputs are validated before blockchain interaction
4. **Error Handling**: Graceful handling of network failures and transaction errors

## Gas Optimization

- Gas price is configurable via properties
- Gas limit is set per operation type
- Failed transactions are logged for analysis
- Retry logic for network failures

## Monitoring

The service provides:
- Health check endpoint (`/api/blockchain/status`)
- Detailed logging of all blockchain operations
- Metrics for transaction success/failure rates
- Error tracking and alerting

## Development

### Local Development
1. Set up environment variables
2. Ensure network connectivity to Polygon Mumbai
3. Fund the account with Mumbai MATIC tokens
4. Deploy the smart contract (see `smart-contracts/` directory)

### Adding New Features
1. Update the smart contract if needed
2. Regenerate contract wrappers using web3j Maven plugin
3. Implement new service methods
4. Add corresponding REST endpoints
5. Update tests and documentation

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check RPC URL and network connectivity
2. **Insufficient Funds**: Ensure account has enough MATIC for gas
3. **Transaction Failed**: Check gas limits and contract address
4. **Slow Responses**: Network congestion, consider increasing timeouts

### Logs
```bash
# View blockchain service logs
docker logs modulo-backend | grep blockchain

# View transaction details
docker logs modulo-backend | grep "transaction"
```

## Future Enhancements

- [ ] Support for multiple networks (mainnet, other testnets)
- [ ] Batch operations for multiple notes
- [ ] Event listening for real-time updates
- [ ] Caching layer for frequently accessed data
- [ ] Integration with existing note management system
- [ ] Enhanced error recovery and retry mechanisms
