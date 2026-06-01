// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NexusDexERC20.sol";

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract NexusDexPair is NexusDexERC20 {
    address public factory;
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    bool private unlocked = true;

    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    error Forbidden();
    error Locked();
    error AlreadyInitialized();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientOutputAmount();
    error InsufficientLiquidity();
    error InvalidTo();
    error K();
    error TransferFailed();

    modifier lock() {
        if (!unlocked) revert Locked();
        unlocked = false;
        _;
        unlocked = true;
    }

    constructor() NexusDexERC20("NEXUS DEX LP", "NEX-LP") {
        factory = msg.sender;
    }

    function initialize(address token0_, address token1_) external {
        if (msg.sender != factory) revert Forbidden();
        if (token0 != address(0) || token1 != address(0)) revert AlreadyInitialized();
        token0 = token0_;
        token1 = token1_;
    }

    function getReserves() external view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    function mint(address to) external lock returns (uint256 liquidity) {
        (uint112 reserve0_, uint112 reserve1_) = (reserve0, reserve1);
        uint256 balance0 = IERC20Like(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Like(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - reserve0_;
        uint256 amount1 = balance1 - reserve1_;

        if (totalSupply == 0) {
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0x000000000000000000000000000000000000dEaD), MINIMUM_LIQUIDITY);
        } else {
            liquidity = min((amount0 * totalSupply) / reserve0_, (amount1 * totalSupply) / reserve1_);
        }
        if (liquidity == 0) revert InsufficientLiquidityMinted();

        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external lock returns (uint256 amount0, uint256 amount1) {
        uint256 balance0 = IERC20Like(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Like(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];

        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();

        _burn(address(this), liquidity);
        _safeTransfer(token0, to, amount0);
        _safeTransfer(token1, to, amount1);

        balance0 = IERC20Like(token0).balanceOf(address(this));
        balance1 = IERC20Like(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to) external lock {
        if (amount0Out == 0 && amount1Out == 0) revert InsufficientOutputAmount();
        (uint112 reserve0_, uint112 reserve1_) = (reserve0, reserve1);
        if (amount0Out >= reserve0_ || amount1Out >= reserve1_) revert InsufficientLiquidity();
        if (to == token0 || to == token1) revert InvalidTo();

        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);

        uint256 balance0 = IERC20Like(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Like(token1).balanceOf(address(this));
        uint256 amount0In = balance0 > reserve0_ - amount0Out ? balance0 - (reserve0_ - amount0Out) : 0;
        uint256 amount1In = balance1 > reserve1_ - amount1Out ? balance1 - (reserve1_ - amount1Out) : 0;
        if (amount0In == 0 && amount1In == 0) revert InsufficientOutputAmount();

        uint256 balance0Adjusted = (balance0 * 1000) - (amount0In * 3);
        uint256 balance1Adjusted = (balance1 * 1000) - (amount1In * 3);
        if (balance0Adjusted * balance1Adjusted < uint256(reserve0_) * reserve1_ * 1_000_000) revert K();

        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        bool ok = IERC20Like(token).transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    function min(uint256 x, uint256 y) private pure returns (uint256) {
        return x < y ? x : y;
    }

    function sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = (y / 2) + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
