// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISwapRouter
 * @notice Interface for swapping stablecoins to ROOTS
 * @dev For testnet: MockSwapRouter implements this with fixed rate
 *      For mainnet: Would integrate with Uniswap V3 or Aerodrome
 */
interface ISwapRouter {
    /**
     * @notice Swap stablecoins (USDC/USDT) for ROOTS tokens
     * @param stablecoin Address of the stablecoin to swap from
     * @param stablecoinAmount Amount of stablecoin to swap (6 decimals)
     * @param minRootsOut Minimum ROOTS to receive (slippage protection)
     * @return rootsOut Actual ROOTS received
     */
    function swapStablecoinForRoots(
        address stablecoin,
        uint256 stablecoinAmount,
        uint256 minRootsOut
    ) external returns (uint256 rootsOut);

    /**
     * @notice Get quote for swapping stablecoin to ROOTS
     * @param stablecoinAmount Amount of stablecoin (6 decimals)
     * @return rootsAmount Expected ROOTS output (18 decimals)
     */
    function getQuote(uint256 stablecoinAmount) external view returns (uint256 rootsAmount);
}
