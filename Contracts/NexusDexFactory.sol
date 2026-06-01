// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexusDexPair.sol";
import "./NexusDexLibrary.sol";

contract NexusDexFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    address public feeToSetter;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    error PairExists();

    constructor(address feeToSetter_) {
        feeToSetter = feeToSetter_;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) public returns (address pair) {
        (address token0, address token1) = NexusDexLibrary.sortTokens(tokenA, tokenB);
        if (getPair[token0][token1] != address(0)) revert PairExists();

        pair = address(new NexusDexPair());
        NexusDexPair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
