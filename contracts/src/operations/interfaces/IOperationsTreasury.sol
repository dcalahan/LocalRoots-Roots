// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOperationsTreasury
 * @notice Interface for the Operations Treasury contract
 * @dev Manages USDC payments for external services (Anthropic, Pinata, etc.)
 */
interface IOperationsTreasury {
    // ============ Structs ============

    struct ServiceConfig {
        string name;              // Human-readable name (e.g., "Anthropic", "Pinata")
        address payee;            // Payment destination address
        uint256 monthlyBudget;    // Maximum USDC per month (6 decimals)
        uint256 currentSpend;     // Amount spent this month
        uint256 lastResetTime;    // Timestamp when currentSpend was last reset
        bool active;              // Whether service is active
        bool requiresOfframp;     // True for fiat-only services (for UI display)
    }

    struct PaymentRecord {
        uint256 timestamp;
        uint256 amount;
        string usageIpfsHash;     // IPFS hash of usage report
        address proposedBy;
        bool executed;
    }

    // ============ Events ============

    event ServiceConfigured(
        bytes32 indexed serviceId,
        string name,
        address payee,
        uint256 monthlyBudget,
        bool requiresOfframp
    );

    event ServiceUpdated(
        bytes32 indexed serviceId,
        address payee,
        uint256 monthlyBudget,
        bool active
    );

    event PaymentProposed(
        bytes32 indexed serviceId,
        uint256 indexed paymentIndex,
        uint256 amount,
        string usageIpfsHash,
        address proposedBy
    );

    event PaymentExecuted(
        bytes32 indexed serviceId,
        uint256 indexed paymentIndex,
        address payee,
        uint256 amount,
        string usageIpfsHash
    );

    event MonthlyBudgetReset(
        bytes32 indexed serviceId,
        uint256 previousSpend,
        uint256 resetTime
    );

    event SafeUpdated(address indexed oldSafe, address indexed newSafe);

    // ============ View Functions ============

    function safe() external view returns (address);
    function usdc() external view returns (address);
    function getServiceConfig(bytes32 serviceId) external view returns (ServiceConfig memory);
    function getServiceIds() external view returns (bytes32[] memory);
    function getPaymentCount(bytes32 serviceId) external view returns (uint256);
    function getPaymentRecord(bytes32 serviceId, uint256 index) external view returns (PaymentRecord memory);
    function canSpend(bytes32 serviceId, uint256 amount) external view returns (bool);
    function getRemainingBudget(bytes32 serviceId) external view returns (uint256);

    // ============ Admin Functions (Safe only) ============

    function configureService(
        bytes32 serviceId,
        string calldata name,
        address payee,
        uint256 monthlyBudget,
        bool requiresOfframp
    ) external;

    function updateService(
        bytes32 serviceId,
        address payee,
        uint256 monthlyBudget,
        bool active
    ) external;

    function executePayment(
        bytes32 serviceId,
        uint256 amount,
        string calldata usageIpfsHash
    ) external;

    function resetMonthlySpend(bytes32 serviceId) external;

    function updateSafe(address newSafe) external;

    function withdrawUSDC(address to, uint256 amount) external;
}
