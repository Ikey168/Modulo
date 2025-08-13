// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title NoteRegistry
 * @dev Blockchain-based registry for storing note hashes and ownership
 * @author Modulo Team
 * @notice This contract allows users to register note hashes on-chain for integrity verification
 */
contract NoteRegistry {
    // Note structure
    struct Note {
        address owner;
        bytes32 hash;
        uint256 timestamp;
        string title;
        bool isActive;
    }

    // Mapping from note ID to Note
    mapping(uint256 => Note) public notes;
    // Mapping from owner to their note IDs
    mapping(address => uint256[]) public ownerNotes;
    // Mapping from hash to note ID (for duplicate prevention)
    mapping(bytes32 => uint256) public hashToNoteId;
    // Note counter
    uint256 public noteCount;

    // Events
    event NoteRegistered(address indexed owner, uint256 indexed noteId, bytes32 hash, string title, uint256 timestamp);
    event NoteUpdated(address indexed owner, uint256 indexed noteId, bytes32 newHash, uint256 timestamp);
    event NoteDeactivated(address indexed owner, uint256 indexed noteId, uint256 timestamp);
    event OwnershipTransferred(uint256 indexed noteId, address indexed previousOwner, address indexed newOwner);

    // Modifiers
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
