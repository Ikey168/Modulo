# Modulo Smart Contracts

This directory contains the smart contracts for the Modulo note registry system, built on Ethereum using Solidity and Hardhat.

## Overview

The NoteRegistry smart contract provides blockchain-based integrity verification for notes in the Modulo system. It allows users to:

- Register note hashes on-chain for immutable proof of existence
- Verify note ownership and integrity
- Transfer note ownership between addresses
- Maintain a decentralized registry of note metadata

## Smart Contract Features

### Core Functionality
- **Note Registration**: Store note hashes with timestamps and metadata
- **Ownership Management**: Track and transfer note ownership
- **Integrity Verification**: Verify note existence and ownership
- **Note Updates**: Update note hashes while maintaining history
- **Soft Deletion**: Deactivate notes without losing history

### Security Features
- Owner-only modifications with strict access control
- Prevention of duplicate note hashes
- Input validation for all parameters
- Gas-optimized operations
- Comprehensive event logging

## Project Structure

```
smart-contracts/
├── contracts/
│   └── NoteRegistry.sol          # Main smart contract
├── test/
│   └── NoteRegistry.test.js      # Comprehensive test suite
├── scripts/
│   ├── deploy.js                 # Deployment script
│   └── interact.js               # Contract interaction examples
├── hardhat.config.js             # Hardhat configuration
├── package.json                  # Node.js dependencies
└── .env.example                  # Environment variables template
```

## Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. Navigate to the smart-contracts directory:
```bash
cd smart-contracts
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Development

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm run test
```

### Test Coverage
```bash
npm run coverage
```

### Code Linting
```bash
npm run lint
npm run lint:fix
```

## Deployment

### Local Development
1. Start a local Hardhat node:
```bash
npm run node
```

2. Deploy to local network:
```bash
npm run deploy:local
```

### Testnet Deployment
1. Configure your `.env` file with Sepolia network details
2. Deploy to Sepolia testnet:
```bash
npm run deploy:testnet
```

### Mainnet Deployment
1. Configure your `.env` file with mainnet details
2. Deploy to mainnet:
```bash
npm run deploy
```

## Contract Interface

### Main Functions

#### `registerNote(bytes32 hash, string title) → uint256 noteId`
Register a new note on-chain with the given hash and title.

#### `verifyNote(bytes32 hash) → (bool exists, bool isOwner, bool isActive)`
Verify if a note exists and check ownership status.

#### `updateNote(uint256 noteId, bytes32 newHash)`
Update an existing note's hash (owner only).

#### `deactivateNote(uint256 noteId)`
Deactivate a note (soft delete, owner only).

#### `transferOwnership(uint256 noteId, address newOwner)`
Transfer note ownership to another address.

### Query Functions

#### `getNote(uint256 noteId) → Note`
Get complete note details by ID.

#### `getNoteByHash(bytes32 hash) → Note`
Get note details by hash.

#### `getNotesByOwner(address owner) → uint256[]`
Get all note IDs owned by an address.

#### `getActiveNoteCount(address owner) → uint256`
Get count of active notes for an owner.

## Events

The contract emits the following events:

- `NoteRegistered(address owner, uint256 noteId, bytes32 hash, string title, uint256 timestamp)`
- `NoteUpdated(address owner, uint256 noteId, bytes32 newHash, uint256 timestamp)`
- `NoteDeactivated(address owner, uint256 noteId, uint256 timestamp)`
- `OwnershipTransferred(uint256 noteId, address previousOwner, address newOwner)`

## Gas Optimization

The contract is optimized for gas efficiency:
- Packed structs to minimize storage slots
- Efficient mapping structures for O(1) lookups
- Minimal external calls
- Optimized loops and operations

## Security Considerations

- All state-changing functions include proper access control
- Input validation prevents invalid operations
- Reentrancy protection through careful state management
- Events provide comprehensive audit trail

## Integration with Frontend

The smart contract integrates with the Modulo frontend through:

1. **Web3 Provider**: Connect using MetaMask or similar wallet
2. **Contract ABI**: Generated during compilation for frontend integration
3. **Event Listening**: Subscribe to contract events for real-time updates
4. **Hash Generation**: Frontend generates note hashes before registration

## Testing

The test suite covers:
- Complete functionality testing
- Access control verification
- Edge case handling
- Gas usage optimization
- Event emission verification

Run tests with detailed output:
```bash
npm test -- --reporter spec
```

## Contributing

1. Follow Solidity style guide
2. Add comprehensive tests for new features
3. Update documentation for interface changes
4. Run linting before committing
5. Ensure all tests pass

## License

MIT License - see LICENSE file for details.
