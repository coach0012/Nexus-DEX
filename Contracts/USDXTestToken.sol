// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexusDexERC20.sol";

/// @notice Minimal test-only USDX token with a rate-limited faucet.
/// @dev Use for Nexus testnet demos only. Do not deploy as production money.
contract USDXTestToken is NexusDexERC20 {
    uint256 public constant CLAIM_AMOUNT = 10 ether;
    uint256 public constant COOLDOWN = 6 hours;

    mapping(address => uint256) public lastClaimedAt;

    event Claimed(address indexed account, uint256 amount);

    error CooldownActive();

    constructor() NexusDexERC20("USDX Test Token", "USDX") {}

    function claim() external {
        if (block.timestamp < lastClaimedAt[msg.sender] + COOLDOWN) revert CooldownActive();
        lastClaimedAt[msg.sender] = block.timestamp;
        _mint(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }
}
