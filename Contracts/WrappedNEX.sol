// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexusDexERC20.sol";

contract WrappedNEX is NexusDexERC20 {
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    error TransferFailed();

    constructor() NexusDexERC20("Wrapped NEX", "WNEX") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(msg.sender, amount);
    }
}
