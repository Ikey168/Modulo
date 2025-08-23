// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title NoteRegistryWithAccessControl
 * @dev Enhanced blockchain-based registry with granular access control
 * @author Modulo Team
 * @notice This contract allows users to register note hashes and manage permissions on-chain
 */
contract NoteRegistryWithAccessControl {
    // Permission levels
    enum Permission { NONE, READ, WRITE, ADMIN }

    // Note structure
    struct Note {
        address owner;
        bytes32 hash;
        uint256 timestamp;
        string title;
        bool isActive;
        bool isPublic; // Public read access
    }

    // Permission structure
    struct NotePermission {
        Permission level;
        uint256 grantedAt;
        address grantedBy;
    }

    // Mappings
    mapping(uint256 => Note) public notes;
    mapping(address => uint256[]) public ownerNotes;
    mapping(bytes32 => uint256) public hashToNoteId;
    // noteId => grantee => permission
    mapping(uint256 => mapping(address => NotePermission)) public notePermissions;
    // noteId => list of addresses with permissions
    mapping(uint256 => address[]) public noteCollaborators;
    
    uint256 public noteCount;

    // Events
    event NoteRegistered(address indexed owner, uint256 indexed noteId, bytes32 hash, string title, uint256 timestamp, bool isPublic);
    event NoteUpdated(address indexed updater, uint256 indexed noteId, bytes32 newHash, uint256 timestamp);
    event NoteDeactivated(address indexed owner, uint256 indexed noteId, uint256 timestamp);
    event OwnershipTransferred(uint256 indexed noteId, address indexed previousOwner, address indexed newOwner);
    event PermissionGranted(uint256 indexed noteId, address indexed grantee, address indexed granter, Permission permission, uint256 timestamp);
    event PermissionRevoked(uint256 indexed noteId, address indexed grantee, address indexed revoker, uint256 timestamp);
    event NoteVisibilityChanged(uint256 indexed noteId, bool isPublic, uint256 timestamp);

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

    modifier hasReadPermission(uint256 noteId) {
        require(
            notes[noteId].owner == msg.sender ||
            notes[noteId].isPublic ||
            notePermissions[noteId][msg.sender].level >= Permission.READ,
            "No read permission"
        );
        _;
    }

    modifier hasWritePermission(uint256 noteId) {
        require(
            notes[noteId].owner == msg.sender ||
            notePermissions[noteId][msg.sender].level >= Permission.WRITE,
            "No write permission"
        );
        _;
    }

    modifier hasAdminPermission(uint256 noteId) {
        require(
            notes[noteId].owner == msg.sender ||
            notePermissions[noteId][msg.sender].level == Permission.ADMIN,
            "No admin permission"
        );
        _;
    }

    /**
     * @dev Register a new note hash on-chain
     * @param hash The hash of the note content
     * @param title The title of the note
     * @param isPublic Whether the note should be publicly readable
     * @return noteId The ID of the registered note
     */
    function registerNote(bytes32 hash, string memory title, bool isPublic) 
        external 
        returns (uint256 noteId) 
    {
        require(hash != 0, "Hash cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(hashToNoteId[hash] == 0, "Note hash already exists");

        noteId = ++noteCount;
        notes[noteId] = Note({
            owner: msg.sender,
            hash: hash,
            timestamp: block.timestamp,
            title: title,
            isActive: true,
            isPublic: isPublic
        });
        ownerNotes[msg.sender].push(noteId);
        hashToNoteId[hash] = noteId;
        
        emit NoteRegistered(msg.sender, noteId, hash, title, block.timestamp, isPublic);
    }

    /**
     * @dev Update an existing note's hash
     * @param noteId The ID of the note to update
     * @param newHash The new hash of the note content
     */
    function updateNote(uint256 noteId, bytes32 newHash) 
        external 
        noteExists(noteId) 
        hasWritePermission(noteId)
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
     * @dev Grant permission to access a note
     * @param noteId The ID of the note
     * @param grantee The address to grant permission to
     * @param permission The permission level to grant
     */
    function grantPermission(uint256 noteId, address grantee, Permission permission) 
        external 
        noteExists(noteId) 
        hasAdminPermission(noteId)
        noteActive(noteId) 
    {
        require(grantee != address(0), "Cannot grant to zero address");
        require(grantee != notes[noteId].owner, "Owner already has all permissions");
        require(permission != Permission.NONE, "Use revokePermission to remove access");
        
        // If this is a new collaborator, add to the list
        if (notePermissions[noteId][grantee].level == Permission.NONE) {
            noteCollaborators[noteId].push(grantee);
        }
        
        notePermissions[noteId][grantee] = NotePermission({
            level: permission,
            grantedAt: block.timestamp,
            grantedBy: msg.sender
        });
        
        emit PermissionGranted(noteId, grantee, msg.sender, permission, block.timestamp);
    }

    /**
     * @dev Revoke permission to access a note
     * @param noteId The ID of the note
     * @param grantee The address to revoke permission from
     */
    function revokePermission(uint256 noteId, address grantee) 
        external 
        noteExists(noteId) 
        hasAdminPermission(noteId)
    {
        require(grantee != notes[noteId].owner, "Cannot revoke owner permissions");
        require(notePermissions[noteId][grantee].level != Permission.NONE, "No permission to revoke");
        
        // Remove from collaborators list
        address[] storage collaborators = noteCollaborators[noteId];
        for (uint256 i = 0; i < collaborators.length; i++) {
            if (collaborators[i] == grantee) {
                collaborators[i] = collaborators[collaborators.length - 1];
                collaborators.pop();
                break;
            }
        }
        
        delete notePermissions[noteId][grantee];
        
        emit PermissionRevoked(noteId, grantee, msg.sender, block.timestamp);
    }

    /**
     * @dev Change note visibility (public/private)
     * @param noteId The ID of the note
     * @param isPublic New visibility setting
     */
    function setNoteVisibility(uint256 noteId, bool isPublic) 
        external 
        noteExists(noteId) 
        onlyOwner(noteId)
        noteActive(noteId) 
    {
        notes[noteId].isPublic = isPublic;
        emit NoteVisibilityChanged(noteId, isPublic, block.timestamp);
    }

    /**
     * @dev Get permission level for a user on a note
     * @param noteId The ID of the note
     * @param user The address to check
     * @return permission The permission level
     */
    function getPermission(uint256 noteId, address user) 
        external 
        view 
        noteExists(noteId) 
        returns (Permission permission) 
    {
        if (notes[noteId].owner == user) {
            return Permission.ADMIN;
        }
        return notePermissions[noteId][user].level;
    }

    /**
     * @dev Get all collaborators for a note
     * @param noteId The ID of the note
     * @return collaborators Array of addresses with permissions
     */
    function getNoteCollaborators(uint256 noteId) 
        external 
        view 
        noteExists(noteId) 
        hasReadPermission(noteId)
        returns (address[] memory collaborators) 
    {
        return noteCollaborators[noteId];
    }

    /**
     * @dev Get detailed permission info for a collaborator
     * @param noteId The ID of the note
     * @param collaborator The address to check
     * @return permission The complete permission structure
     */
    function getPermissionDetails(uint256 noteId, address collaborator) 
        external 
        view 
        noteExists(noteId) 
        hasReadPermission(noteId)
        returns (NotePermission memory permission) 
    {
        return notePermissions[noteId][collaborator];
    }

    /**
     * @dev Check if user has specific permission level or higher
     * @param noteId The ID of the note
     * @param user The address to check
     * @param requiredPermission The minimum permission level required
     * @return hasPermission Whether user has the required permission
     */
    function hasPermission(uint256 noteId, address user, Permission requiredPermission) 
        external 
        view 
        noteExists(noteId) 
        returns (bool hasPermission) 
    {
        if (notes[noteId].owner == user) {
            return true;
        }
        
        if (requiredPermission == Permission.READ && notes[noteId].isPublic) {
            return true;
        }
        
        return notePermissions[noteId][user].level >= requiredPermission;
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

    // View functions for backward compatibility and additional functionality
    
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
    function getNote(uint256 noteId) 
        external 
        view 
        noteExists(noteId) 
        hasReadPermission(noteId)
        returns (Note memory note) 
    {
        return notes[noteId];
    }

    /**
     * @dev Get note details by hash
     * @param hash The hash of the note
     * @return note The complete note structure
     */
    function getNoteByHash(bytes32 hash) 
        external 
        view 
        returns (Note memory note) 
    {
        uint256 noteId = hashToNoteId[hash];
        require(noteId > 0, "Note does not exist");
        require(
            notes[noteId].owner == msg.sender ||
            notes[noteId].isPublic ||
            notePermissions[noteId][msg.sender].level >= Permission.READ,
            "No read permission"
        );
        return notes[noteId];
    }

    /**
     * @dev Verify if a note hash exists and get permission information
     * @param hash The hash to verify
     * @return exists Whether the hash exists
     * @return hasReadAccess Whether the sender can read the note
     * @return hasWriteAccess Whether the sender can write the note
     * @return isActive Whether the note is active
     */
    function verifyNoteAccess(bytes32 hash) 
        external 
        view 
        returns (bool exists, bool hasReadAccess, bool hasWriteAccess, bool isActive) 
    {
        uint256 noteId = hashToNoteId[hash];
        if (noteId > 0) {
            exists = true;
            isActive = notes[noteId].isActive;
            
            if (notes[noteId].owner == msg.sender) {
                hasReadAccess = true;
                hasWriteAccess = true;
            } else {
                hasReadAccess = notes[noteId].isPublic || 
                               notePermissions[noteId][msg.sender].level >= Permission.READ;
                hasWriteAccess = notePermissions[noteId][msg.sender].level >= Permission.WRITE;
            }
        }
    }

    /**
     * @dev Get the total number of registered notes
     * @return count Total note count
     */
    function getTotalNoteCount() external view returns (uint256 count) {
        return noteCount;
    }

    /**
     * @dev Get notes accessible by a user (owned + permitted)
     * @param user The address of the user
     * @return accessibleNotes Array of note IDs the user can access
     */
    function getAccessibleNotes(address user) external view returns (uint256[] memory accessibleNotes) {
        uint256[] memory ownedNotes = ownerNotes[user];
        uint256 totalAccessible = ownedNotes.length;
        
        // Count additional accessible notes
        for (uint256 i = 1; i <= noteCount; i++) {
            if (notes[i].isActive && notes[i].owner != user) {
                if (notes[i].isPublic || notePermissions[i][user].level >= Permission.READ) {
                    totalAccessible++;
                }
            }
        }
        
        // Build accessible notes array
        accessibleNotes = new uint256[](totalAccessible);
        uint256 index = 0;
        
        // Add owned notes
        for (uint256 i = 0; i < ownedNotes.length; i++) {
            if (notes[ownedNotes[i]].isActive) {
                accessibleNotes[index++] = ownedNotes[i];
            }
        }
        
        // Add permitted notes
        for (uint256 i = 1; i <= noteCount; i++) {
            if (notes[i].isActive && notes[i].owner != user) {
                if (notes[i].isPublic || notePermissions[i][user].level >= Permission.READ) {
                    accessibleNotes[index++] = i;
                }
            }
        }
        
        // Resize array if needed
        assembly {
            mstore(accessibleNotes, index)
        }
    }
}
