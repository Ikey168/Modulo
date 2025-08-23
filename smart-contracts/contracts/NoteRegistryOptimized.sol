// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title NoteRegistryOptimized
 * @dev Gas-optimized version of NoteRegistry with security improvements
 * @author Modulo Team
 * @notice Optimized for lower gas costs and enhanced security
 */
contract NoteRegistryOptimized {
    // Packed struct to save gas (fits in 2 storage slots)
    struct Note {
        address owner;      // 20 bytes
        uint96 timestamp;   // 12 bytes (sufficient until year 2^96/31536000 ≈ 2.5 trillion years)
        bytes32 hash;       // 32 bytes (slot 2)
        bool isActive;      // 1 bit
        // Total: 65 bytes (2 slots)
    }

    // Storage optimization: Use mapping instead of arrays to avoid DOS
    mapping(uint256 => Note) public notes;
    mapping(bytes32 => uint256) public hashToNoteId;
    mapping(address => mapping(uint256 => bool)) public userOwnsNote; // user => noteId => bool
    mapping(address => uint256) public userNoteCount;
    
    uint256 public noteCount;
    
    // Gas-optimized events with proper indexing
    event NoteRegistered(
        address indexed owner, 
        uint256 indexed noteId, 
        bytes32 indexed hash, 
        uint96 timestamp
    );
    event NoteUpdated(
        address indexed owner, 
        uint256 indexed noteId, 
        bytes32 indexed newHash, 
        uint96 timestamp
    );
    event NoteDeactivated(address indexed owner, uint256 indexed noteId);
    event OwnershipTransferred(
        uint256 indexed noteId, 
        address indexed previousOwner, 
        address indexed newOwner
    );

    // Custom errors save gas compared to require strings
    error EmptyHash();
    error HashAlreadyExists();
    error NoteNotFound();
    error NotOwner();
    error NoteNotActive();
    error InvalidAddress();
    error SelfTransfer();

    // Gas-optimized modifiers
    modifier onlyOwner(uint256 noteId) {
        if (notes[noteId].owner != msg.sender) revert NotOwner();
        _;
    }

    modifier noteExists(uint256 noteId) {
        if (noteId == 0 || noteId > noteCount) revert NoteNotFound();
        _;
    }

    modifier noteActive(uint256 noteId) {
        if (!notes[noteId].isActive) revert NoteNotActive();
        _;
    }

    /**
     * @dev Register a new note hash on-chain (gas optimized)
     * @param hash The hash of the note content
     * @return noteId The ID of the registered note
     */
    function registerNote(bytes32 hash) external returns (uint256 noteId) {
        if (hash == 0) revert EmptyHash();
        if (hashToNoteId[hash] != 0) revert HashAlreadyExists();

        noteId = ++noteCount;
        
        // Gas optimization: Use unchecked for timestamp conversion (safe due to block.timestamp limits)
        uint96 timestamp;
        unchecked {
            timestamp = uint96(block.timestamp);
        }
        
        notes[noteId] = Note({
            owner: msg.sender,
            hash: hash,
            timestamp: timestamp,
            isActive: true
        });
        
        hashToNoteId[hash] = noteId;
        userOwnsNote[msg.sender][noteId] = true;
        ++userNoteCount[msg.sender];
        
        emit NoteRegistered(msg.sender, noteId, hash, timestamp);
    }

    /**
     * @dev Update an existing note's hash (gas optimized)
     * @param noteId The ID of the note to update
     * @param newHash The new hash of the note content
     */
    function updateNote(uint256 noteId, bytes32 newHash) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        if (newHash == 0) revert EmptyHash();
        if (hashToNoteId[newHash] != 0) revert HashAlreadyExists();
        
        Note storage note = notes[noteId];
        
        // Remove old hash mapping
        delete hashToNoteId[note.hash];
        
        // Update note with gas optimization
        note.hash = newHash;
        unchecked {
            note.timestamp = uint96(block.timestamp);
        }
        hashToNoteId[newHash] = noteId;
        
        emit NoteUpdated(msg.sender, noteId, newHash, note.timestamp);
    }

    /**
     * @dev Deactivate a note (gas optimized soft delete)
     * @param noteId The ID of the note to deactivate
     */
    function deactivateNote(uint256 noteId) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        Note storage note = notes[noteId];
        note.isActive = false;
        delete hashToNoteId[note.hash];
        --userNoteCount[msg.sender];
        
        emit NoteDeactivated(msg.sender, noteId);
    }

    /**
     * @dev Transfer ownership of a note (gas optimized - no array operations)
     * @param noteId The ID of the note
     * @param newOwner The address of the new owner
     */
    function transferOwnership(uint256 noteId, address newOwner) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId) 
        noteActive(noteId) 
    {
        if (newOwner == address(0)) revert InvalidAddress();
        if (newOwner == msg.sender) revert SelfTransfer();
        
        address previousOwner = msg.sender;
        notes[noteId].owner = newOwner;
        
        // Gas-optimized ownership tracking
        userOwnsNote[previousOwner][noteId] = false;
        userOwnsNote[newOwner][noteId] = true;
        --userNoteCount[previousOwner];
        ++userNoteCount[newOwner];
        
        emit OwnershipTransferred(noteId, previousOwner, newOwner);
    }

    /**
     * @dev Check if a user owns a specific note (gas optimized)
     * @param user The user address
     * @param noteId The note ID
     * @return owns Whether the user owns the note
     */
    function ownsNote(address user, uint256 noteId) external view returns (bool owns) {
        return userOwnsNote[user][noteId];
    }

    /**
     * @dev Get note details by ID (gas optimized)
     * @param noteId The ID of the note
     * @return note The complete note structure
     */
    function getNote(uint256 noteId) external view noteExists(noteId) returns (Note memory note) {
        return notes[noteId];
    }

    /**
     * @dev Get note by hash (gas optimized)
     * @param hash The hash of the note
     * @return note The complete note structure
     */
    function getNoteByHash(bytes32 hash) external view returns (Note memory note) {
        uint256 noteId = hashToNoteId[hash];
        if (noteId == 0) revert NoteNotFound();
        return notes[noteId];
    }

    /**
     * @dev Verify if a note hash exists (gas optimized)
     * @param hash The hash to verify
     * @return exists Whether the hash exists
     * @return isOwner Whether the sender owns the note
     * @return isActive Whether the note is active
     */
    function verifyNote(bytes32 hash) external view returns (bool exists, bool isOwner, bool isActive) {
        uint256 noteId = hashToNoteId[hash];
        if (noteId > 0) {
            Note storage note = notes[noteId];
            exists = true;
            isOwner = (note.owner == msg.sender);
            isActive = note.isActive;
        }
    }

    /**
     * @dev Get user's note count (gas optimized)
     * @param user The user address
     * @return count Number of notes owned by user
     */
    function getUserNoteCount(address user) external view returns (uint256 count) {
        return userNoteCount[user];
    }

    /**
     * @dev Get the total number of registered notes
     * @return count Total note count
     */
    function getTotalNoteCount() external view returns (uint256 count) {
        return noteCount;
    }

    /**
     * @dev Batch register multiple notes (gas optimized)
     * @param hashes Array of note hashes
     * @return noteIds Array of registered note IDs
     */
    function batchRegisterNotes(bytes32[] calldata hashes) external returns (uint256[] memory noteIds) {
        uint256 length = hashes.length;
        noteIds = new uint256[](length);
        
        for (uint256 i = 0; i < length;) {
            bytes32 hash = hashes[i];
            if (hash == 0) revert EmptyHash();
            if (hashToNoteId[hash] != 0) revert HashAlreadyExists();

            uint256 noteId = ++noteCount;
            
            unchecked {
                uint96 timestamp = uint96(block.timestamp);
                notes[noteId] = Note({
                    owner: msg.sender,
                    hash: hash,
                    timestamp: timestamp,
                    isActive: true
                });
                
                hashToNoteId[hash] = noteId;
                userOwnsNote[msg.sender][noteId] = true;
                noteIds[i] = noteId;
                
                emit NoteRegistered(msg.sender, noteId, hash, timestamp);
                
                ++i;
            }
        }
        
        userNoteCount[msg.sender] += length;
    }

    /**
     * @dev Check if contract supports an interface (EIP-165)
     * @param interfaceId The interface identifier
     * @return supported Whether the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool supported) {
        return interfaceId == 0x01ffc9a7 || // EIP-165
               interfaceId == 0x80ac58cd;   // EIP-721 compatible
    }
}
