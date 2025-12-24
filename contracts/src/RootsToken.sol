// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title RootsToken ($ROOTS)
 * @notice The native token for the Local Roots marketplace
 * @dev Total supply: 100,000,000 ROOTS
 *
 * Allocation:
 * - 10% Founders (10M) - vested over 3 years with 6-month cliff
 * - 25% Ambassador Rewards (25M) - released as earned
 * - 15% Liquidity (15M) - for Aerodrome LP
 * - 40% Treasury (40M) - DAO controlled
 * - 10% Airdrop (10M) - initial distribution
 */
contract RootsToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;

    // Allocation percentages (basis points, 10000 = 100%)
    uint256 public constant FOUNDER_ALLOCATION = 1000;      // 10%
    uint256 public constant AMBASSADOR_ALLOCATION = 2500;   // 25%
    uint256 public constant LIQUIDITY_ALLOCATION = 1500;    // 15%
    uint256 public constant TREASURY_ALLOCATION = 4000;     // 40%
    uint256 public constant AIRDROP_ALLOCATION = 1000;      // 10%

    // Vesting for founders
    address public immutable founderVesting;
    address public immutable ambassadorRewards;
    address public immutable liquidityPool;
    address public immutable treasury;
    address public immutable airdrop;

    constructor(
        address _founderVesting,
        address _ambassadorRewards,
        address _liquidityPool,
        address _treasury,
        address _airdrop
    ) ERC20("Local Roots", "ROOTS") ERC20Permit("Local Roots") {
        require(_founderVesting != address(0), "Invalid founder vesting address");
        require(_ambassadorRewards != address(0), "Invalid ambassador rewards address");
        require(_liquidityPool != address(0), "Invalid liquidity pool address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_airdrop != address(0), "Invalid airdrop address");

        founderVesting = _founderVesting;
        ambassadorRewards = _ambassadorRewards;
        liquidityPool = _liquidityPool;
        treasury = _treasury;
        airdrop = _airdrop;

        // Mint allocations
        _mint(_founderVesting, (TOTAL_SUPPLY * FOUNDER_ALLOCATION) / 10000);
        _mint(_ambassadorRewards, (TOTAL_SUPPLY * AMBASSADOR_ALLOCATION) / 10000);
        _mint(_liquidityPool, (TOTAL_SUPPLY * LIQUIDITY_ALLOCATION) / 10000);
        _mint(_treasury, (TOTAL_SUPPLY * TREASURY_ALLOCATION) / 10000);
        _mint(_airdrop, (TOTAL_SUPPLY * AIRDROP_ALLOCATION) / 10000);
    }
}
