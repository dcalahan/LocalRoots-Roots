// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title MockSwapRouter
 * @notice Fixed-rate swap router for testnet
 * @dev Swaps stablecoins to ROOTS at a fixed rate of 100 ROOTS = $1 USD
 *      This contract must be funded with ROOTS to perform swaps
 */
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    /// @notice ROOTS token address
    IERC20 public immutable rootsToken;

    /// @notice Exchange rate: 100 ROOTS per 1 USD (stablecoin unit)
    uint256 public constant ROOTS_PER_USD = 100;

    /// @notice USDC/USDT have 6 decimals, ROOTS has 18 decimals
    /// @dev Conversion factor: 10^(18-6) = 10^12
    uint256 public constant DECIMAL_CONVERSION = 1e12;

    /// @notice Accepted stablecoins for swapping
    mapping(address => bool) public acceptedStablecoins;

    /// @notice Contract owner (can add stablecoins and withdraw)
    address public owner;

    event StablecoinAdded(address indexed stablecoin);
    event StablecoinRemoved(address indexed stablecoin);
    event Swap(
        address indexed user,
        address indexed stablecoin,
        uint256 stablecoinAmount,
        uint256 rootsAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _rootsToken) {
        require(_rootsToken != address(0), "Invalid ROOTS address");
        rootsToken = IERC20(_rootsToken);
        owner = msg.sender;
    }

    /**
     * @notice Add a stablecoin as accepted for swaps
     * @param _stablecoin Address of the stablecoin (USDC or USDT)
     */
    function addStablecoin(address _stablecoin) external onlyOwner {
        require(_stablecoin != address(0), "Invalid address");
        acceptedStablecoins[_stablecoin] = true;
        emit StablecoinAdded(_stablecoin);
    }

    /**
     * @notice Remove a stablecoin from accepted list
     * @param _stablecoin Address of the stablecoin
     */
    function removeStablecoin(address _stablecoin) external onlyOwner {
        acceptedStablecoins[_stablecoin] = false;
        emit StablecoinRemoved(_stablecoin);
    }

    /**
     * @notice Get quote for swapping stablecoin to ROOTS
     * @param stablecoinAmount Amount of stablecoin (6 decimals)
     * @return rootsAmount Expected ROOTS output (18 decimals)
     */
    function getQuote(uint256 stablecoinAmount) external pure override returns (uint256 rootsAmount) {
        // 1 USDC (1e6) = 100 ROOTS (100e18)
        // stablecoinAmount * 100 * 1e12 = rootsAmount
        rootsAmount = stablecoinAmount * ROOTS_PER_USD * DECIMAL_CONVERSION;
    }

    /**
     * @notice Swap stablecoins for ROOTS at fixed rate
     * @param stablecoin Address of stablecoin to swap
     * @param stablecoinAmount Amount of stablecoin (6 decimals)
     * @param minRootsOut Minimum ROOTS to receive (slippage protection)
     * @return rootsOut Actual ROOTS received
     */
    function swapStablecoinForRoots(
        address stablecoin,
        uint256 stablecoinAmount,
        uint256 minRootsOut
    ) external override returns (uint256 rootsOut) {
        require(acceptedStablecoins[stablecoin], "Stablecoin not accepted");
        require(stablecoinAmount > 0, "Amount must be > 0");

        // Calculate ROOTS output at fixed rate
        rootsOut = stablecoinAmount * ROOTS_PER_USD * DECIMAL_CONVERSION;
        require(rootsOut >= minRootsOut, "Slippage exceeded");

        // Check we have enough ROOTS to pay out
        require(rootsToken.balanceOf(address(this)) >= rootsOut, "Insufficient ROOTS liquidity");

        // Transfer stablecoin from caller to this contract
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), stablecoinAmount);

        // Transfer ROOTS to caller
        rootsToken.safeTransfer(msg.sender, rootsOut);

        emit Swap(msg.sender, stablecoin, stablecoinAmount, rootsOut);
    }

    /**
     * @notice Withdraw accumulated stablecoins (owner only)
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner, amount);
    }

    /**
     * @notice Get ROOTS balance available for swaps
     */
    function getRootsBalance() external view returns (uint256) {
        return rootsToken.balanceOf(address(this));
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
