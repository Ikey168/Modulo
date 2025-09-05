// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IModuloTokenOptimized {
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MaliciousReentrant
 * @dev Contract used for testing reentrancy protection in smart contracts
 * This contract is designed to attempt reentrancy attacks during testing
 */
contract MaliciousReentrant {
    IModuloTokenOptimized public targetContract;
    bool public attackStarted;
    uint256 public attackCount;
    
    event AttackAttempted(uint256 count);
    
    constructor() {
        attackCount = 0;
        attackStarted = false;
    }
    
    /**
     * @dev Attempt to perform a reentrancy attack on the target contract
     * @param _targetContract Address of the contract to attack
     */
    function attemptReentrancy(address _targetContract) external {
        targetContract = IModuloTokenOptimized(_targetContract);
        attackStarted = true;
        attackCount = 0;
        
        // This should fail due to reentrancy protection in the target contract
        // The target contract should have ReentrancyGuard that prevents this
        targetContract.mint(address(this), 100);
    }
    
    /**
     * @dev Hook that gets called when tokens are received (if implemented)
     * This is where a reentrancy attack would typically occur
     */
    function onTokenReceived() external {
        if (attackStarted && attackCount < 3) {
            attackCount++;
            emit AttackAttempted(attackCount);
            
            // Try to call mint again (reentrancy attempt)
            // This should fail due to ReentrancyGuard
            targetContract.mint(address(this), 100);
        }
    }
    
    /**
     * @dev Function to check if reentrancy protection is working
     * @return bool indicating if the attack was successful (should always be false)
     */
    function wasAttackSuccessful() external view returns (bool) {
        return attackCount > 1; // If count > 1, reentrancy occurred
    }
    
    /**
     * @dev Reset attack state for testing
     */
    function resetAttack() external {
        attackStarted = false;
        attackCount = 0;
    }
}
