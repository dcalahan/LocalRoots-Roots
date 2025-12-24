// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FounderVesting
 * @notice Vesting contract for founder allocation
 * @dev 3-year vesting with 6-month cliff
 */
contract FounderVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;

    uint256 public immutable startTime;
    uint256 public constant CLIFF_DURATION = 180 days;    // 6 months
    uint256 public constant VESTING_DURATION = 1095 days; // 3 years

    uint256 public totalAllocation;
    uint256 public released;

    event TokensReleased(address indexed beneficiary, uint256 amount);

    constructor(address _token, address _beneficiary) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");

        token = IERC20(_token);
        beneficiary = _beneficiary;
        startTime = block.timestamp;
    }

    /**
     * @notice Initialize the total allocation (called once after token transfer)
     */
    function initializeAllocation() external {
        require(totalAllocation == 0, "Already initialized");
        totalAllocation = token.balanceOf(address(this));
        require(totalAllocation > 0, "No tokens to vest");
    }

    /**
     * @notice Calculate the amount of tokens that can be released
     */
    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    /**
     * @notice Calculate the total vested amount at current time
     */
    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < startTime + CLIFF_DURATION) {
            return 0;
        }

        uint256 elapsedTime = block.timestamp - startTime;

        if (elapsedTime >= VESTING_DURATION) {
            return totalAllocation;
        }

        return (totalAllocation * elapsedTime) / VESTING_DURATION;
    }

    /**
     * @notice Release vested tokens to the beneficiary
     */
    function release() external {
        uint256 amount = releasable();
        require(amount > 0, "No tokens to release");

        released += amount;
        token.safeTransfer(beneficiary, amount);

        emit TokensReleased(beneficiary, amount);
    }

    /**
     * @notice Get vesting info
     */
    function vestingInfo() external view returns (
        uint256 _totalAllocation,
        uint256 _released,
        uint256 _releasable,
        uint256 _vestedAmount,
        uint256 _cliffEnd,
        uint256 _vestingEnd
    ) {
        return (
            totalAllocation,
            released,
            releasable(),
            vestedAmount(),
            startTime + CLIFF_DURATION,
            startTime + VESTING_DURATION
        );
    }
}
