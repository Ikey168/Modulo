// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ModuloToken.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title NoteMonetization
 * @dev Enhanced note registry with monetization features using ModuloToken
 * @author Modulo Team
 * @notice This contract allows users to set prices for their notes and earn tokens from access fees
 */
contract NoteMonetization is ReentrancyGuard, Ownable, Pausable {
    
    // Reference to the ModuloToken contract
    ModuloToken public immutable moduloToken;
    
    // Note structure with monetization features
    struct Note {
        address owner;
        bytes32 hash;
        uint256 timestamp;
        string title;
        bool isActive;
        bool isPremium;
        uint256 accessPrice; // Price in MODO tokens (with 18 decimals)
        uint256 totalEarnings;
        uint256 accessCount;
        string category;
        string description;
    }

    // Purchase record
    struct Purchase {
        address buyer;
        uint256 noteId;
        uint256 amount;
        uint256 timestamp;
        bool isValid;
    }

    // Mappings
    mapping(uint256 => Note) public notes;
    mapping(address => uint256[]) public ownerNotes;
    mapping(bytes32 => uint256) public hashToNoteId;
    mapping(uint256 => mapping(address => bool)) public hasAccess; // noteId => buyer => hasAccess
    mapping(address => uint256) public userEarnings;
    mapping(uint256 => Purchase[]) public notePurchases;
    
    // Counters
    uint256 public noteCount;
    uint256 public totalPurchases;
    
    // Platform fees (in basis points, e.g., 250 = 2.5%)
    uint256 public platformFeePercent = 250; // 2.5%
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% maximum
    address public feeRecipient;
    
    // Minimum and maximum prices
    uint256 public constant MIN_PRICE = 1 * 10**15; // 0.001 MODO tokens
    uint256 public constant MAX_PRICE = 1000 * 10**18; // 1000 MODO tokens

    // Events
    event NoteRegistered(
        address indexed owner, 
        uint256 indexed noteId, 
        bytes32 hash, 
        string title, 
        bool isPremium, 
        uint256 accessPrice,
        uint256 timestamp
    );
    event NoteUpdated(address indexed owner, uint256 indexed noteId, bytes32 newHash, uint256 timestamp);
    event NoteDeactivated(address indexed owner, uint256 indexed noteId, uint256 timestamp);
    event NoteAccessGranted(address indexed buyer, uint256 indexed noteId, uint256 amount, uint256 timestamp);
    event PriceUpdated(uint256 indexed noteId, uint256 oldPrice, uint256 newPrice);
    event EarningsWithdrawn(address indexed user, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    // Modifiers
    modifier onlyNoteOwner(uint256 noteId) {
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

    modifier validPrice(uint256 price) {
        require(price >= MIN_PRICE && price <= MAX_PRICE, "Price out of valid range");
        _;
    }

    /**
     * @dev Constructor
     * @param _moduloToken Address of the ModuloToken contract
     */
    constructor(address _moduloToken) {
        require(_moduloToken != address(0), "Invalid token address");
        moduloToken = ModuloToken(_moduloToken);
        feeRecipient = msg.sender;
    }

    /**
     * @dev Register a new note with optional monetization
     * @param hash The hash of the note content
     * @param title The title of the note
     * @param isPremium Whether this is a premium (paid) note
     * @param accessPrice Price for accessing the note (0 for free notes)
     * @param category Category of the note
     * @param description Brief description of the note
     * @return noteId The ID of the registered note
     */
    function registerNote(
        bytes32 hash, 
        string memory title,
        bool isPremium,
        uint256 accessPrice,
        string memory category,
        string memory description
    ) external whenNotPaused returns (uint256 noteId) {
        require(hash != 0, "Hash cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(hashToNoteId[hash] == 0, "Note hash already exists");
        
        if (isPremium) {
            require(accessPrice >= MIN_PRICE && accessPrice <= MAX_PRICE, "Invalid access price");
        } else {
            accessPrice = 0;
        }

        noteId = ++noteCount;
        notes[noteId] = Note({
            owner: msg.sender,
            hash: hash,
            timestamp: block.timestamp,
            title: title,
            isActive: true,
            isPremium: isPremium,
            accessPrice: accessPrice,
            totalEarnings: 0,
            accessCount: 0,
            category: category,
            description: description
        });
        
        ownerNotes[msg.sender].push(noteId);
        hashToNoteId[hash] = noteId;
        
        // Free notes are automatically accessible to everyone
        if (!isPremium) {
            hasAccess[noteId][msg.sender] = true;
        } else {
            // Owner always has access to their own premium notes
            hasAccess[noteId][msg.sender] = true;
        }
        
        emit NoteRegistered(msg.sender, noteId, hash, title, isPremium, accessPrice, block.timestamp);
    }

    /**
     * @dev Purchase access to a premium note
     * @param noteId The ID of the note to purchase access to
     */
    function purchaseNoteAccess(uint256 noteId) 
        external 
        nonReentrant 
        whenNotPaused 
        noteExists(noteId) 
        noteActive(noteId) 
    {
        Note storage note = notes[noteId];
        require(note.isPremium, "Note is not premium");
        require(!hasAccess[noteId][msg.sender], "Already has access");
        require(note.owner != msg.sender, "Cannot purchase own note");
        require(note.accessPrice > 0, "Invalid access price");

        uint256 totalAmount = note.accessPrice;
        uint256 platformFee = (totalAmount * platformFeePercent) / 10000;
        uint256 ownerAmount = totalAmount - platformFee;

        // Transfer tokens from buyer
        require(
            moduloToken.transferFrom(msg.sender, address(this), totalAmount),
            "Token transfer failed"
        );

        // Update state
        hasAccess[noteId][msg.sender] = true;
        note.totalEarnings += ownerAmount;
        note.accessCount += 1;
        userEarnings[note.owner] += ownerAmount;
        userEarnings[feeRecipient] += platformFee;

        // Record the purchase
        notePurchases[noteId].push(Purchase({
            buyer: msg.sender,
            noteId: noteId,
            amount: totalAmount,
            timestamp: block.timestamp,
            isValid: true
        }));

        totalPurchases++;

        emit NoteAccessGranted(msg.sender, noteId, totalAmount, block.timestamp);
    }

    /**
     * @dev Update the access price of a premium note
     * @param noteId The ID of the note
     * @param newPrice The new access price
     */
    function updateNotePrice(uint256 noteId, uint256 newPrice) 
        external 
        noteExists(noteId) 
        onlyNoteOwner(noteId) 
        noteActive(noteId)
        validPrice(newPrice)
    {
        Note storage note = notes[noteId];
        require(note.isPremium, "Note is not premium");
        
        uint256 oldPrice = note.accessPrice;
        note.accessPrice = newPrice;
        
        emit PriceUpdated(noteId, oldPrice, newPrice);
    }

    /**
     * @dev Convert a free note to premium or vice versa
     * @param noteId The ID of the note
     * @param isPremium Whether to make it premium
     * @param accessPrice Price if converting to premium
     */
    function updateNotePremiumStatus(uint256 noteId, bool isPremium, uint256 accessPrice) 
        external 
        noteExists(noteId) 
        onlyNoteOwner(noteId) 
        noteActive(noteId)
    {
        Note storage note = notes[noteId];
        
        if (isPremium && !note.isPremium) {
            require(accessPrice >= MIN_PRICE && accessPrice <= MAX_PRICE, "Invalid access price");
            note.isPremium = true;
            note.accessPrice = accessPrice;
        } else if (!isPremium && note.isPremium) {
            note.isPremium = false;
            note.accessPrice = 0;
        }
    }

    /**
     * @dev Withdraw earned tokens
     * @param amount Amount to withdraw (0 to withdraw all)
     */
    function withdrawEarnings(uint256 amount) external nonReentrant whenNotPaused {
        uint256 availableEarnings = userEarnings[msg.sender];
        require(availableEarnings > 0, "No earnings to withdraw");
        
        if (amount == 0) {
            amount = availableEarnings;
        } else {
            require(amount <= availableEarnings, "Insufficient earnings");
        }

        userEarnings[msg.sender] -= amount;
        require(moduloToken.transfer(msg.sender, amount), "Token transfer failed");

        emit EarningsWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Check if user has access to a note
     * @param noteId The ID of the note
     * @param user The user address to check
     * @return bool Whether the user has access
     */
    function checkNoteAccess(uint256 noteId, address user) external view noteExists(noteId) returns (bool) {
        Note memory note = notes[noteId];
        
        // Free notes are accessible to everyone
        if (!note.isPremium) {
            return true;
        }
        
        // Check if user has purchased access or is the owner
        return hasAccess[noteId][user];
    }

    /**
     * @dev Get note details including monetization info
     * @param noteId The ID of the note
     * @return owner The owner of the note
     * @return hash The hash of the note
     * @return timestamp The creation timestamp
     * @return title The title of the note
     * @return isActive Whether the note is active
     * @return isPremium Whether the note is premium
     * @return accessPrice The access price in tokens
     * @return totalEarnings The total revenue generated
     * @return accessCount The total number of purchases
     * @return category The category of the note
     * @return description The description of the note
     */
    function getNoteDetails(uint256 noteId) external view noteExists(noteId) returns (
        address owner,
        bytes32 hash,
        uint256 timestamp,
        string memory title,
        bool isActive,
        bool isPremium,
        uint256 accessPrice,
        uint256 totalEarnings,
        uint256 accessCount,
        string memory category,
        string memory description
    ) {
        Note memory note = notes[noteId];
        return (
            note.owner,
            note.hash,
            note.timestamp,
            note.title,
            note.isActive,
            note.isPremium,
            note.accessPrice,
            note.totalEarnings,
            note.accessCount,
            note.category,
            note.description
        );
    }

    /**
     * @dev Get user's notes with pagination
     * @param user User address
     * @param offset Starting index
     * @param limit Number of notes to return
     * @return noteIds Array of note IDs
     */
    function getUserNotes(address user, uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory noteIds) 
    {
        uint256[] memory userNoteIds = ownerNotes[user];
        uint256 totalNotes = userNoteIds.length;
        
        if (offset >= totalNotes) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > totalNotes) {
            end = totalNotes;
        }
        
        uint256 resultLength = end - offset;
        noteIds = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            noteIds[i] = userNoteIds[offset + i];
        }
    }

    /**
     * @dev Update platform fee (only owner)
     * @param newFeePercent New fee percentage in basis points
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= MAX_PLATFORM_FEE, "Fee too high");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }

    /**
     * @dev Update fee recipient (only owner)
     * @param newRecipient New fee recipient address
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @dev Pause the contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to recover accidentally sent tokens
     * @param token Token contract address
     * @param amount Amount to recover
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(moduloToken), "Cannot recover MODO tokens");
        IERC20(token).transfer(owner(), amount);
    }
}
