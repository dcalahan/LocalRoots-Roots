// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MultiFounderVesting
 * @notice Vesting contract for multiple founder allocations
 * @dev 3-year vesting with 6-month cliff, each beneficiary has individual allocation
 */
contract MultiFounderVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public admin;

    uint256 public immutable startTime;
    uint256 public constant CLIFF_DURATION = 180 days;    // 6 months
    uint256 public constant VESTING_DURATION = 1095 days; // 3 years

    struct Beneficiary {
        uint256 allocation;  // Total tokens allocated
        uint256 released;    // Tokens already released
        bool exists;         // Whether beneficiary exists
    }

    mapping(address => Beneficiary) public beneficiaries;
    address[] public beneficiaryList;
    uint256 public totalAllocated;
    bool public initialized;

    event BeneficiaryAdded(address indexed beneficiary, uint256 allocation);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        admin = msg.sender;
        startTime = block.timestamp;
    }

    /**
     * @notice Add multiple beneficiaries with their allocations
     * @dev Can only be called before initialization
     * @param _beneficiaries Array of beneficiary addresses
     * @param _allocations Array of token allocations (in wei)
     */
    function addBeneficiaries(
        address[] calldata _beneficiaries,
        uint256[] calldata _allocations
    ) external onlyAdmin {
        require(!initialized, "Already initialized");
        require(_beneficiaries.length == _allocations.length, "Arrays length mismatch");

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            address beneficiary = _beneficiaries[i];
            uint256 allocation = _allocations[i];

            require(beneficiary != address(0), "Invalid beneficiary address");
            require(allocation > 0, "Allocation must be > 0");
            require(!beneficiaries[beneficiary].exists, "Beneficiary already added");

            beneficiaries[beneficiary] = Beneficiary({
                allocation: allocation,
                released: 0,
                exists: true
            });
            beneficiaryList.push(beneficiary);
            totalAllocated += allocation;

            emit BeneficiaryAdded(beneficiary, allocation);
        }
    }

    /**
     * @notice Initialize the vesting (called after tokens are transferred)
     * @dev Verifies contract has enough tokens for all allocations
     */
    function initialize() external onlyAdmin {
        require(!initialized, "Already initialized");
        require(beneficiaryList.length > 0, "No beneficiaries added");

        uint256 balance = token.balanceOf(address(this));
        require(balance >= totalAllocated, "Insufficient token balance");

        initialized = true;
    }

    /**
     * @notice Calculate vested amount for a beneficiary at current time
     */
    function vestedAmount(address _beneficiary) public view returns (uint256) {
        Beneficiary storage b = beneficiaries[_beneficiary];
        if (!b.exists) return 0;

        if (block.timestamp < startTime + CLIFF_DURATION) {
            return 0;
        }

        uint256 elapsedTime = block.timestamp - startTime;

        if (elapsedTime >= VESTING_DURATION) {
            return b.allocation;
        }

        return (b.allocation * elapsedTime) / VESTING_DURATION;
    }

    /**
     * @notice Calculate releasable amount for a beneficiary
     */
    function releasable(address _beneficiary) public view returns (uint256) {
        return vestedAmount(_beneficiary) - beneficiaries[_beneficiary].released;
    }

    /**
     * @notice Release vested tokens to caller
     */
    function release() external {
        _release(msg.sender);
    }

    /**
     * @notice Release vested tokens for a specific beneficiary
     * @param _beneficiary Address to release tokens to
     */
    function releaseFor(address _beneficiary) external {
        _release(_beneficiary);
    }

    function _release(address _beneficiary) internal {
        require(initialized, "Not initialized");
        require(beneficiaries[_beneficiary].exists, "Not a beneficiary");

        uint256 amount = releasable(_beneficiary);
        require(amount > 0, "No tokens to release");

        beneficiaries[_beneficiary].released += amount;
        token.safeTransfer(_beneficiary, amount);

        emit TokensReleased(_beneficiary, amount);
    }

    /**
     * @notice Get vesting info for a beneficiary
     */
    function getBeneficiaryInfo(address _beneficiary) external view returns (
        uint256 allocation,
        uint256 released,
        uint256 _releasable,
        uint256 _vestedAmount
    ) {
        Beneficiary storage b = beneficiaries[_beneficiary];
        return (
            b.allocation,
            b.released,
            releasable(_beneficiary),
            vestedAmount(_beneficiary)
        );
    }

    /**
     * @notice Get global vesting info
     */
    function vestingInfo() external view returns (
        uint256 _totalAllocated,
        uint256 _beneficiaryCount,
        uint256 _cliffEnd,
        uint256 _vestingEnd,
        bool _initialized
    ) {
        return (
            totalAllocated,
            beneficiaryList.length,
            startTime + CLIFF_DURATION,
            startTime + VESTING_DURATION,
            initialized
        );
    }

    /**
     * @notice Get all beneficiaries
     */
    function getBeneficiaries() external view returns (address[] memory) {
        return beneficiaryList;
    }

    /**
     * @notice Transfer admin role
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }
}
