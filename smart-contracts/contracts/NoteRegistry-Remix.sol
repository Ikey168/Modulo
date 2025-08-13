// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title NoteRegistry - Flattened for Remix IDE
 * @dev A blockchain-based note registry for integrity verification and ownership management
 * 
 * This flattened version includes all dependencies in a single file for easy deployment in Remix.
 * 
 * Features:
 * - Store note hashes on-chain with timestamps and metadata
 * - Ownership management with secure transfers
 * - Note verification and integrity checking
 * - Gas-optimized storage and operations
 * - Comprehensive event logging for audit trails
 */
contract NoteRegistry {
    // Data structure for storing note information
    struct Note {
        address owner;      // Address that owns the note
        bytes32 hash;       // Hash of the note content
        uint256 timestamp;  // Timestamp when the note was registered
        string title;       // Human-readable title for the note
        bool isActive;      // Whether the note is active (not deactivated)
    }

    // State variables
    mapping(uint256 => Note) public notes;           // noteId => Note
    mapping(address => uint256[]) public ownerNotes; // owner => array of noteIds
    mapping(bytes32 => uint256) public hashToNoteId; // hash => noteId (for uniqueness)
    uint256 public noteCount;                        // Total number of notes registered

    // Events for logging important contract interactions
    event NoteRegistered(
        address indexed owner,
        uint256 indexed noteId,
        bytes32 indexed hash,
        string title,
        uint256 timestamp
    );

    event NoteUpdated(
        address indexed owner,
        uint256 indexed noteId,
        bytes32 indexed newHash,
        uint256 timestamp
    );

    event NoteDeactivated(
        address indexed owner,
        uint256 indexed noteId,
        uint256 timestamp
    );

    event OwnershipTransferred(
        uint256 indexed noteId,
        address indexed previousOwner,
        address indexed newOwner
    );

    // Modifiers for access control and validation
    modifier onlyOwner(uint256 noteId) {
        require(notes[noteId].owner == msg.sender, "Not the owner of this note");
        _;
    }

    modifier noteExists(uint256 noteId) {
        require(noteId > 0 && noteId <= noteCount, "Note does not exist");
        _;
    }

    modifier noteActive(uint256 noteId) {
        require(notes[noteId].isActive, "Note is not active");
        _;
    }

    /**
     * @dev Register a new note hash on-chain
     * @param hash The hash of the note content
     * @param title The title of the note
     * @return noteId The ID of the registered note
     */
    function registerNote(bytes32 hash, string memory title) external returns (uint256 noteId) {
        require(hash != 0, "Hash cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(hashToNoteId[hash] == 0, "Note hash already exists");

        noteId = ++noteCount;
        notes[noteId] = Note({
            owner: msg.sender,
            hash: hash,
            timestamp: block.timestamp,
            title: title,
            isActive: true
        });
        ownerNotes[msg.sender].push(noteId);
        hashToNoteId[hash] = noteId;
        
        emit NoteRegistered(msg.sender, noteId, hash, title, block.timestamp);
    }

    /**
     * @dev Update an existing note's hash
     * @param noteId The ID of the note to update
     * @param newHash The new hash of the note content
     */
    function updateNote(uint256 noteId, bytes32 newHash) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        require(newHash != 0, "Hash cannot be empty");
        require(hashToNoteId[newHash] == 0, "Note hash already exists");
        
        // Remove old hash mapping
        delete hashToNoteId[notes[noteId].hash];
        
        // Update note
        notes[noteId].hash = newHash;
        notes[noteId].timestamp = block.timestamp;
        hashToNoteId[newHash] = noteId;
        
        emit NoteUpdated(msg.sender, noteId, newHash, block.timestamp);
    }

    /**
     * @dev Deactivate a note (soft delete)
     * @param noteId The ID of the note to deactivate
     */
    function deactivateNote(uint256 noteId) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        notes[noteId].isActive = false;
        delete hashToNoteId[notes[noteId].hash];
        
        emit NoteDeactivated(msg.sender, noteId, block.timestamp);
    }

    /**
     * @dev Transfer ownership of a note to another address
     * @param noteId The ID of the note
     * @param newOwner The address of the new owner
     */
    function transferOwnership(uint256 noteId, address newOwner) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        require(newOwner != address(0), "Cannot transfer to zero address");
        require(newOwner != msg.sender, "Cannot transfer to yourself");
        
        address previousOwner = notes[noteId].owner;
        notes[noteId].owner = newOwner;
        
        // Add to new owner's notes
        ownerNotes[newOwner].push(noteId);
        
        // Remove from previous owner's notes
        uint256[] storage prevOwnerNotes = ownerNotes[previousOwner];
        for (uint256 i = 0; i < prevOwnerNotes.length; i++) {
            if (prevOwnerNotes[i] == noteId) {
                prevOwnerNotes[i] = prevOwnerNotes[prevOwnerNotes.length - 1];
                prevOwnerNotes.pop();
                break;
            }
        }
        
        emit OwnershipTransferred(noteId, previousOwner, newOwner);
    }

    /**
     * @dev Get all note IDs owned by a user
     * @param user The address of the user
     * @return noteIds Array of note IDs
     */
    function getNotesByOwner(address user) external view returns (uint256[] memory noteIds) {
        return ownerNotes[user];
    }

    /**
     * @dev Get note details by ID
     * @param noteId The ID of the note
     * @return note The complete note structure
     */
    function getNote(uint256 noteId) external view noteExists(noteId) returns (Note memory note) {
        return notes[noteId];
    }

    /**
     * @dev Get note details by hash
     * @param hash The hash of the note
     * @return note The complete note structure
     */
    function getNoteByHash(bytes32 hash) external view returns (Note memory note) {
        uint256 noteId = hashToNoteId[hash];
        require(noteId > 0, "Note does not exist");
        return notes[noteId];
    }

    /**
     * @dev Verify if a note hash exists and get ownership information
     * @param hash The hash to verify
     * @return exists Whether the hash exists
     * @return isOwner Whether the sender owns the note
     * @return isActive Whether the note is active
     */
    function verifyNote(bytes32 hash) external view returns (bool exists, bool isOwner, bool isActive) {
        uint256 noteId = hashToNoteId[hash];
        if (noteId > 0) {
            exists = true;
            isOwner = (notes[noteId].owner == msg.sender);
            isActive = notes[noteId].isActive;
        }
    }

    /**
     * @dev Get active note count for an owner
     * @param owner The owner address
     * @return count Number of active notes
     */
    function getActiveNoteCount(address owner) external view returns (uint256 count) {
        uint256[] memory userNotes = ownerNotes[owner];
        for (uint256 i = 0; i < userNotes.length; i++) {
            if (notes[userNotes[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @dev Check if an address owns a specific note
     * @param noteId The note ID
     * @param owner The address to check
     * @return isOwner Whether the address owns the note
     */
    function isNoteOwner(uint256 noteId, address owner) external view noteExists(noteId) returns (bool isOwner) {
        return notes[noteId].owner == owner;
    }

    /**
     * @dev Get the total number of registered notes
     * @return count Total note count
     */
    function getTotalNoteCount() external view returns (uint256 count) {
        return noteCount;
    }

    /**
     * @dev Verify ownership of a note (legacy function for backward compatibility)
     * @param noteId The ID of the note
     * @return isOwner True if caller owns the note
     */
    function isOwner(uint256 noteId) external view returns (bool isOwner) {
        return notes[noteId].owner == msg.sender;
    }
}

/*
 * DEPLOYMENT INSTRUCTIONS FOR REMIX IDE:
 * 
 * 1. Open Remix IDE (https://remix.ethereum.org/)
 * 
 * 2. Create a new file named "NoteRegistry.sol" and paste this entire code
 * 
 * 3. Compile:
 *    - Go to the Solidity Compiler tab
 *    - Select compiler version 0.8.19 or higher
 *    - Click "Compile NoteRegistry.sol"
 * 
 * 4. Deploy to Mumbai:
 *    - Go to Deploy & Run Transactions tab
 *    - Environment: Select "Injected Provider - MetaMask"
 *    - Make sure MetaMask is connected to Mumbai testnet
 *    - Contract: Select "NoteRegistry"
 *    - Click "Deploy"
 * 
 * 5. Interact:
 *    - Use the deployed contract interface in Remix
 *    - Test functions like registerNote, verifyNote, etc.
 * 
 * MUMBAI TESTNET SETUP:
 * 
 * Network Name: Mumbai Testnet
 * RPC URL: https://rpc-mumbai.maticvigil.com/
 * Chain ID: 80001
 * Currency Symbol: MATIC
 * Block Explorer: https://mumbai.polygonscan.com/
 * 
 * Get test MATIC: https://faucet.polygon.technology/
 * 
 * EXAMPLE INTERACTIONS:
 * 
 * 1. Register a note:
 *    registerNote(
 *      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
 *      "My Test Note"
 *    )
 * 
 * 2. Verify a note:
 *    verifyNote("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
 * 
 * 3. Get total notes:
 *    getTotalNoteCount()
 * 
 * 4. Get user notes:
 *    getNotesByOwner("YOUR_ADDRESS")
 */
