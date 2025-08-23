// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ModuloTokenOptimized
 * @dev Gas-optimized and security-enhanced ERC-20 token for the Modulo ecosystem
 * @author Modulo Team
 * @notice Optimized token with advanced security features and gas efficiency
 */
contract ModuloTokenOptimized is ERC20, ERC20Burnable, Pausable, Ownable, ReentrancyGuard {
    
    // Constants for gas optimization
    uint8 private constant DECIMALS = 18;
    uint256 private constant INITIAL_SUPPLY = 100_000_000 * 10**DECIMALS;
    uint256 private constant MAX_SUPPLY = 1_000_000_000 * 10**DECIMALS;
    
    // Packed struct for minter info (fits in 1 slot)
    struct MinterInfo {
        bool isMinter;          // 1 bit
        uint96 mintedAmount;    // 12 bytes  
        uint96 lastMintTime;    // 12 bytes
        uint64 mintAllowance;   // 8 bytes
        // Total: 33 bytes (1 slot + 1 byte)
    }
    
    // Gas-optimized storage
    mapping(address => MinterInfo) public minters;
    mapping(address => uint256) private _nonces; // For permit functionality
    
    // Rate limiting for minting
    uint256 public constant MAX_MINT_PER_DAY = 1_000_000 * 10**DECIMALS;
    uint256 public constant MINT_COOLDOWN = 1 days;
    
    // Events with proper indexing
    event MinterAdded(address indexed minter, uint64 allowance);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, address indexed minter, uint256 amount);
    event MintAllowanceUpdated(address indexed minter, uint64 newAllowance);

    // Custom errors for gas optimization
    error InvalidMinter();
    error MinterExists();
    error MinterNotFound();
    error ExceedsMaxSupply();
    error ExceedsMintLimit();
    error MintCooldownActive();
    error InsufficientAllowance();
    error InvalidAmount();
    error ZeroAddress();

    // Modifiers
    modifier onlyMinter() {
        if (!minters[msg.sender].isMinter && msg.sender != owner()) revert InvalidMinter();
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    /**
     * @dev Constructor with gas-optimized initialization
     */
    constructor() ERC20("Modulo Token", "MODO") {
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Set owner as initial minter with full allowance
        minters[msg.sender] = MinterInfo({
            isMinter: true,
            mintedAmount: 0,
            lastMintTime: uint96(block.timestamp),
            mintAllowance: type(uint64).max
        });
        
        emit MinterAdded(msg.sender, type(uint64).max);
    }

    /**
     * @dev Returns the number of decimals
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Returns the maximum supply
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @dev Add a new minter with specific allowance (gas optimized)
     * @param minter Address to be added as minter
     * @param allowance Maximum tokens this minter can mint
     */
    function addMinter(address minter, uint64 allowance) external onlyOwner validAddress(minter) {
        if (minters[minter].isMinter) revert MinterExists();
        
        minters[minter] = MinterInfo({
            isMinter: true,
            mintedAmount: 0,
            lastMintTime: uint96(block.timestamp),
            mintAllowance: allowance
        });
        
        emit MinterAdded(minter, allowance);
    }

    /**
     * @dev Remove a minter (gas optimized)
     * @param minter Address to be removed from minters
     */
    function removeMinter(address minter) external onlyOwner {
        if (!minters[minter].isMinter) revert MinterNotFound();
        
        delete minters[minter];
        emit MinterRemoved(minter);
    }

    /**
     * @dev Update minter allowance
     * @param minter Address of the minter
     * @param newAllowance New allowance amount
     */
    function updateMinterAllowance(address minter, uint64 newAllowance) external onlyOwner {
        if (!minters[minter].isMinter) revert MinterNotFound();
        
        minters[minter].mintAllowance = newAllowance;
        emit MintAllowanceUpdated(minter, newAllowance);
    }

    /**
     * @dev Mint new tokens with rate limiting and allowance checks
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused validAddress(to) nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        
        MinterInfo storage minterInfo = minters[msg.sender];
        
        // Rate limiting check
        if (block.timestamp < minterInfo.lastMintTime + MINT_COOLDOWN) {
            if (minterInfo.mintedAmount + amount > MAX_MINT_PER_DAY) {
                revert ExceedsMintLimit();
            }
        } else {
            // Reset daily counter
            minterInfo.mintedAmount = 0;
            minterInfo.lastMintTime = uint96(block.timestamp);
        }
        
        // Allowance check
        if (amount > minterInfo.mintAllowance) revert InsufficientAllowance();
        
        // Update minter info
        unchecked {
            minterInfo.mintedAmount += uint96(amount);
            if (minterInfo.mintAllowance != type(uint64).max) {
                minterInfo.mintAllowance -= uint64(amount);
            }
        }
        
        _mint(to, amount);
        emit TokensMinted(to, msg.sender, amount);
    }

    /**
     * @dev Batch mint to multiple addresses (gas optimized)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyMinter 
        whenNotPaused 
        nonReentrant 
    {
        uint256 length = recipients.length;
        if (length != amounts.length) revert InvalidAmount();
        
        uint256 totalAmount = 0;
        
        // Calculate total amount first
        for (uint256 i = 0; i < length;) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            totalAmount += amounts[i];
            unchecked { ++i; }
        }
        
        if (totalSupply() + totalAmount > MAX_SUPPLY) revert ExceedsMaxSupply();
        
        MinterInfo storage minterInfo = minters[msg.sender];
        
        // Rate limiting and allowance checks
        if (block.timestamp < minterInfo.lastMintTime + MINT_COOLDOWN) {
            if (minterInfo.mintedAmount + totalAmount > MAX_MINT_PER_DAY) {
                revert ExceedsMintLimit();
            }
        } else {
            minterInfo.mintedAmount = 0;
            minterInfo.lastMintTime = uint96(block.timestamp);
        }
        
        if (totalAmount > minterInfo.mintAllowance) revert InsufficientAllowance();
        
        // Update minter info
        unchecked {
            minterInfo.mintedAmount += uint96(totalAmount);
            if (minterInfo.mintAllowance != type(uint64).max) {
                minterInfo.mintAllowance -= uint64(totalAmount);
            }
        }
        
        // Perform mints
        for (uint256 i = 0; i < length;) {
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], msg.sender, amounts[i]);
            unchecked { ++i; }
        }
    }

    /**
     * @dev Enhanced burn with event emission
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override whenNotPaused {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @dev Enhanced burnFrom with event emission
     * @param account Account to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address account, uint256 amount) public override whenNotPaused {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }

    /**
     * @dev Get minter information
     * @param minter Address of the minter
     * @return info Complete minter information
     */
    function getMinterInfo(address minter) external view returns (MinterInfo memory info) {
        return minters[minter];
    }

    /**
     * @dev Check if address is a minter
     * @param addr Address to check
     * @return isMinter Whether the address is a minter
     */
    function isMinter(address addr) external view returns (bool) {
        return minters[addr].isMinter;
    }

    /**
     * @dev Get remaining mint allowance for a minter
     * @param minter Address of the minter
     * @return remaining Remaining allowance
     */
    function getRemainingAllowance(address minter) external view returns (uint64 remaining) {
        return minters[minter].mintAllowance;
    }

    /**
     * @dev Pause the contract (emergency function)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transfer to respect pause state
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // Custom event for burns
    event TokensBurned(address indexed from, uint256 amount);
}
