// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexusDexFactory.sol";
import "./NexusDexLibrary.sol";

interface IERC20Router {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract NexusDexRouter {
    address public immutable factory;

    event LiquidityAdded(address indexed user, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity);
    event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    error Expired();
    error TransferFailed();
    error InsufficientAAmount();
    error InsufficientBAmount();
    error PathUnsupported();

    modifier ensure(uint256 deadline) {
        if (deadline < block.timestamp) revert Expired();
        _;
    }

    constructor(address factory_) {
        factory = factory_;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        address pair = NexusDexFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) pair = NexusDexFactory(factory).createPair(tokenA, tokenB);

        (amountA, amountB) = _calculateLiquidityAmounts(tokenA, tokenB, amountADesired, amountBDesired);
        if (amountA < amountAMin) revert InsufficientAAmount();
        if (amountB < amountBMin) revert InsufficientBAmount();

        _safeTransferFrom(tokenA, msg.sender, pair, amountA);
        _safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = NexusDexPair(pair).mint(to);
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        if (path.length != 2) revert PathUnsupported();
        address pair = NexusDexFactory(factory).getPair(path[0], path[1]);
        (uint112 reserve0, uint112 reserve1) = NexusDexPair(pair).getReserves();
        (address token0,) = NexusDexLibrary.sortTokens(path[0], path[1]);
        (uint256 reserveIn, uint256 reserveOut) = path[0] == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        amountOut = NexusDexLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert NexusDexLibrary.InsufficientAmount();

        _safeTransferFrom(path[0], msg.sender, pair, amountIn);
        (uint256 amount0Out, uint256 amount1Out) = path[0] == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        NexusDexPair(pair).swap(amount0Out, amount1Out, to);
        emit SwapExecuted(msg.sender, path[0], path[1], amountIn, amountOut);
    }

    function quoteAddLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired)
        external
        view
        returns (uint256 amountA, uint256 amountB)
    {
        return _calculateLiquidityAmounts(tokenA, tokenB, amountADesired, amountBDesired);
    }

    function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut) external view returns (uint256) {
        address pair = NexusDexFactory(factory).getPair(tokenIn, tokenOut);
        (uint112 reserve0, uint112 reserve1) = NexusDexPair(pair).getReserves();
        (address token0,) = NexusDexLibrary.sortTokens(tokenIn, tokenOut);
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return NexusDexLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function _calculateLiquidityAmounts(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired)
        private
        view
        returns (uint256 amountA, uint256 amountB)
    {
        address pair = NexusDexFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) return (amountADesired, amountBDesired);
        (uint112 reserve0, uint112 reserve1) = NexusDexPair(pair).getReserves();
        if (reserve0 == 0 && reserve1 == 0) return (amountADesired, amountBDesired);

        (address token0,) = NexusDexLibrary.sortTokens(tokenA, tokenB);
        (uint256 reserveA, uint256 reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 amountBOptimal = NexusDexLibrary.quote(amountADesired, reserveA, reserveB);
        if (amountBOptimal <= amountBDesired) {
            return (amountADesired, amountBOptimal);
        }
        uint256 amountAOptimal = NexusDexLibrary.quote(amountBDesired, reserveB, reserveA);
        return (amountAOptimal, amountBDesired);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20Router(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
