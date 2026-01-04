// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IOperationsTreasury.sol";

/**
 * @title OperationsTreasury
 * @notice Manages USDC payments for external services from a Gnosis Safe-controlled treasury
 * @dev All admin functions can only be called by the Gnosis Safe multisig
 *
 * This contract holds USDC and pays for operational costs like:
 * - AI services (Anthropic Claude)
 * - Storage services (Pinata IPFS)
 * - Payment processors (Crossmint, thirdweb)
 * - Auth services (Privy)
 *
 * Key features:
 * - Monthly budget limits per service
 * - On-chain payment history for transparency
 * - Usage reports stored on IPFS and linked to payments
 * - Pausable for emergencies
 */
contract OperationsTreasury is IOperationsTreasury, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice Address of the Gnosis Safe that controls this treasury
    address public override safe;

    /// @notice USDC token contract
    IERC20 public immutable usdcToken;

    /// @notice Array of all service IDs for enumeration
    bytes32[] private _serviceIds;

    /// @notice Mapping of serviceId => ServiceConfig
    mapping(bytes32 => ServiceConfig) private _services;

    /// @notice Mapping of serviceId => PaymentRecord[]
    mapping(bytes32 => PaymentRecord[]) private _payments;

    /// @notice Mapping to check if serviceId exists
    mapping(bytes32 => bool) private _serviceExists;

    /// @notice Duration of a budget month (30 days)
    uint256 public constant MONTH_DURATION = 30 days;

    // ============ Constructor ============

    /**
     * @notice Initialize the Operations Treasury
     * @param _safe Address of the Gnosis Safe multisig
     * @param _usdc Address of the USDC token contract
     */
    constructor(address _safe, address _usdc) {
        require(_safe != address(0), "Invalid safe address");
        require(_usdc != address(0), "Invalid USDC address");

        safe = _safe;
        usdcToken = IERC20(_usdc);
    }

    // ============ Modifiers ============

    /// @notice Restrict function to Safe only
    modifier onlySafe() {
        require(msg.sender == safe, "Only Safe can call");
        _;
    }

    // ============ View Functions ============

    /// @notice Get USDC address
    function usdc() external view override returns (address) {
        return address(usdcToken);
    }

    /// @notice Get service configuration
    function getServiceConfig(bytes32 serviceId) external view override returns (ServiceConfig memory) {
        require(_serviceExists[serviceId], "Service not found");
        return _services[serviceId];
    }

    /// @notice Get all service IDs
    function getServiceIds() external view override returns (bytes32[] memory) {
        return _serviceIds;
    }

    /// @notice Get number of payments for a service
    function getPaymentCount(bytes32 serviceId) external view override returns (uint256) {
        return _payments[serviceId].length;
    }

    /// @notice Get a specific payment record
    function getPaymentRecord(bytes32 serviceId, uint256 index) external view override returns (PaymentRecord memory) {
        require(index < _payments[serviceId].length, "Invalid payment index");
        return _payments[serviceId][index];
    }

    /// @notice Check if a payment amount is within budget
    function canSpend(bytes32 serviceId, uint256 amount) public view override returns (bool) {
        if (!_serviceExists[serviceId]) return false;

        ServiceConfig storage config = _services[serviceId];
        if (!config.active) return false;

        // Check if we need to reset the month
        uint256 currentSpend = config.currentSpend;
        if (block.timestamp >= config.lastResetTime + MONTH_DURATION) {
            currentSpend = 0;
        }

        return currentSpend + amount <= config.monthlyBudget;
    }

    /// @notice Get remaining budget for a service this month
    function getRemainingBudget(bytes32 serviceId) external view override returns (uint256) {
        if (!_serviceExists[serviceId]) return 0;

        ServiceConfig storage config = _services[serviceId];
        if (!config.active) return 0;

        // Check if we need to reset the month
        uint256 currentSpend = config.currentSpend;
        if (block.timestamp >= config.lastResetTime + MONTH_DURATION) {
            currentSpend = 0;
        }

        if (currentSpend >= config.monthlyBudget) return 0;
        return config.monthlyBudget - currentSpend;
    }

    /// @notice Get total USDC balance in treasury
    function getBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    // ============ Admin Functions (Safe Only) ============

    /**
     * @notice Configure a new service
     * @param serviceId Unique identifier for the service (e.g., keccak256("anthropic"))
     * @param name Human-readable name
     * @param payee Payment destination address
     * @param monthlyBudget Maximum USDC per month (6 decimals)
     * @param requiresOfframp True if service only accepts fiat
     */
    function configureService(
        bytes32 serviceId,
        string calldata name,
        address payee,
        uint256 monthlyBudget,
        bool requiresOfframp
    ) external override onlySafe whenNotPaused {
        require(!_serviceExists[serviceId], "Service already exists");
        require(payee != address(0), "Invalid payee address");
        require(monthlyBudget > 0, "Budget must be > 0");
        require(bytes(name).length > 0, "Name required");

        _services[serviceId] = ServiceConfig({
            name: name,
            payee: payee,
            monthlyBudget: monthlyBudget,
            currentSpend: 0,
            lastResetTime: block.timestamp,
            active: true,
            requiresOfframp: requiresOfframp
        });

        _serviceIds.push(serviceId);
        _serviceExists[serviceId] = true;

        emit ServiceConfigured(serviceId, name, payee, monthlyBudget, requiresOfframp);
    }

    /**
     * @notice Update an existing service configuration
     * @param serviceId Service identifier
     * @param payee New payment destination (or same to keep unchanged)
     * @param monthlyBudget New monthly budget
     * @param active Whether service is active
     */
    function updateService(
        bytes32 serviceId,
        address payee,
        uint256 monthlyBudget,
        bool active
    ) external override onlySafe whenNotPaused {
        require(_serviceExists[serviceId], "Service not found");
        require(payee != address(0), "Invalid payee address");
        require(monthlyBudget > 0, "Budget must be > 0");

        ServiceConfig storage config = _services[serviceId];
        config.payee = payee;
        config.monthlyBudget = monthlyBudget;
        config.active = active;

        emit ServiceUpdated(serviceId, payee, monthlyBudget, active);
    }

    /**
     * @notice Execute a payment to a service
     * @param serviceId Service identifier
     * @param amount USDC amount to pay (6 decimals)
     * @param usageIpfsHash IPFS hash of the usage report for this period
     */
    function executePayment(
        bytes32 serviceId,
        uint256 amount,
        string calldata usageIpfsHash
    ) external override onlySafe nonReentrant whenNotPaused {
        require(_serviceExists[serviceId], "Service not found");
        require(amount > 0, "Amount must be > 0");
        require(bytes(usageIpfsHash).length > 0, "Usage hash required");

        ServiceConfig storage config = _services[serviceId];
        require(config.active, "Service not active");

        // Auto-reset monthly spend if needed
        if (block.timestamp >= config.lastResetTime + MONTH_DURATION) {
            uint256 previousSpend = config.currentSpend;
            config.currentSpend = 0;
            config.lastResetTime = block.timestamp;
            emit MonthlyBudgetReset(serviceId, previousSpend, block.timestamp);
        }

        // Check budget
        require(config.currentSpend + amount <= config.monthlyBudget, "Exceeds monthly budget");

        // Update spend tracking
        config.currentSpend += amount;

        // Record payment
        uint256 paymentIndex = _payments[serviceId].length;
        _payments[serviceId].push(PaymentRecord({
            timestamp: block.timestamp,
            amount: amount,
            usageIpfsHash: usageIpfsHash,
            proposedBy: msg.sender,
            executed: true
        }));

        emit PaymentProposed(serviceId, paymentIndex, amount, usageIpfsHash, msg.sender);

        // Execute transfer
        usdcToken.safeTransfer(config.payee, amount);

        emit PaymentExecuted(serviceId, paymentIndex, config.payee, amount, usageIpfsHash);
    }

    /**
     * @notice Manually reset monthly spend for a service
     * @param serviceId Service identifier
     */
    function resetMonthlySpend(bytes32 serviceId) external override onlySafe {
        require(_serviceExists[serviceId], "Service not found");

        ServiceConfig storage config = _services[serviceId];
        uint256 previousSpend = config.currentSpend;
        config.currentSpend = 0;
        config.lastResetTime = block.timestamp;

        emit MonthlyBudgetReset(serviceId, previousSpend, block.timestamp);
    }

    /**
     * @notice Update the Safe address (for migration)
     * @param newSafe New Gnosis Safe address
     */
    function updateSafe(address newSafe) external override onlySafe {
        require(newSafe != address(0), "Invalid safe address");

        address oldSafe = safe;
        safe = newSafe;

        emit SafeUpdated(oldSafe, newSafe);
    }

    /**
     * @notice Withdraw USDC to a specific address (emergency or planned withdrawal)
     * @param to Destination address
     * @param amount Amount to withdraw
     */
    function withdrawUSDC(address to, uint256 amount) external override onlySafe nonReentrant {
        require(to != address(0), "Invalid destination");
        require(amount > 0, "Amount must be > 0");

        usdcToken.safeTransfer(to, amount);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Pause the contract (emergency only)
     */
    function pause() external onlySafe {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlySafe {
        _unpause();
    }

    // ============ Helper Functions ============

    /**
     * @notice Generate a service ID from a name
     * @param name Service name (e.g., "anthropic")
     * @return serviceId The keccak256 hash of the name
     */
    function generateServiceId(string calldata name) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }
}
