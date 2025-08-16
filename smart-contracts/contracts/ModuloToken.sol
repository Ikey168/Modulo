// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ModuloToken
 * @dev ERC-20 token for the Modulo ecosystem, enabling note monetization
 * @author Modulo Team
 * @notice This token allows users to monetize their notes and pay for premium content access
 */
contract ModuloToken is ERC20, ERC20Burnable, Pausable, Ownable {
    
    // Token decimals (18 is standard for most ERC-20 tokens)
    uint8 private constant DECIMALS = 18;
    
    // Initial supply (100 million tokens)
    uint256 private constant INITIAL_SUPPLY = 100_000_000 * 10**DECIMALS;
    
    // Maximum supply cap (1 billion tokens)
    uint256 private constant MAX_SUPPLY = 1_000_000_000 * 10**DECIMALS;
    
    // Minting roles
    mapping(address => bool) public minters;
    
    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    // Modifiers
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    /**
     * @dev Constructor that gives msg.sender all of initial tokens.
     */
    constructor() ERC20("Modulo Token", "MODO") {
        _mint(msg.sender, INITIAL_SUPPLY);
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Returns the maximum supply of tokens.
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @dev Add a new minter address
     * @param minter Address to be added as minter
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        require(!minters[minter], "Address is already a minter");
        
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @dev Remove a minter address
     * @param minter Address to be removed from minters
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "Address is not a minter");
        
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @dev Mint new tokens (only by authorized minters)
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Burn tokens from caller's account
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public override whenNotPaused {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from specified account (requires allowance)
     * @param account Account to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) public override whenNotPaused {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }

    /**
     * @dev Pause all token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause all token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transfer to add pause functionality
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Emergency function to recover accidentally sent ERC20 tokens
     * @param token Token contract address
     * @param amount Amount to recover
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot recover own tokens");
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Emergency function to recover accidentally sent ETH
     */
    function recoverETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
