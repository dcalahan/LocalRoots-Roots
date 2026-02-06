// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title IAmbassadorRewardsForGov
 * @notice Minimal interface for ambassador data needed by government requests
 */
interface IAmbassadorRewardsForGov {
    struct Ambassador {
        address wallet;
        uint256 uplineId;
        uint256 totalEarned;
        uint256 totalPending;
        uint256 recruitedSellers;
        uint256 recruitedAmbassadors;
        uint256 createdAt;
        bool active;
        bool suspended;
        bytes8 regionGeohash;
        string profileIpfs;
    }

    function ambassadorIdByWallet(address wallet) external view returns (uint256);
    function getAmbassador(uint256 ambassadorId) external view returns (Ambassador memory);
    function nextAmbassadorId() external view returns (uint256);
}

/**
 * @title GovernmentRequests
 * @notice Government data request voting by ambassadors
 * @dev Enables government agencies to request transaction data for food safety
 *
 * Flow:
 * 1. Government submits request with credentials + justification
 * 2. 5-day voting window opens
 * 3. Ambassadors vote: Approve / Deny
 * 4. If approved (majority, min 10 votes): Admin can upload data export
 * 5. All requests publicly logged for transparency
 *
 * What we CAN provide (if approved):
 * - Order records (dates, quantities, seller info)
 * - Wallet addresses of affected buyers
 * - Transaction history for specific products/sellers
 *
 * What we CANNOT provide:
 * - Personal information (names, phones, addresses)
 *   These are encrypted and controlled by users
 */
contract GovernmentRequests is ReentrancyGuard, ERC2771Context {

    // ============ State Variables ============

    IAmbassadorRewardsForGov public ambassadorRewards;

    // Admin management
    address[] public admins;
    mapping(address => bool) public isAdmin;

    // ============ Constants ============

    uint256 public constant VOTE_DURATION = 5 days;
    uint256 public constant MIN_VOTES_REQUIRED = 10;
    uint256 public constant REQUEST_COOLDOWN = 30 days;
    uint256 public constant SEEDS_PER_VOTE = 100 * 1e6; // 100 Seeds

    // ============ Structs ============

    struct DataRequest {
        address requester;
        string agencyName;
        string agencyEmail;
        string jurisdiction;          // State or "Federal"
        string requestType;           // "food_safety" | "other"
        string justification;
        string credentialsIpfs;       // Uploaded supporting docs
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 votesApprove;
        uint256 votesDeny;
        bool resolved;
        bool approved;
        string dataExportIpfs;        // If approved, link to export
        bool adminResolved;           // Was this resolved by admin?
        string adminReason;           // If admin resolved, why
    }

    // ============ Storage ============

    uint256 public nextRequestId;
    mapping(uint256 => DataRequest) public requests;
    mapping(uint256 => mapping(uint256 => bool)) public requestVotes; // requestId => ambassadorId => hasVoted
    mapping(uint256 => mapping(uint256 => bool)) public requestVoteChoice; // requestId => ambassadorId => votedApprove
    mapping(string => uint256) public agencyLastRequest; // agencyName => timestamp (for cooldown)

    // ============ Events ============

    event RequestSubmitted(
        uint256 indexed requestId,
        address indexed requester,
        string agencyName,
        string jurisdiction,
        string requestType
    );

    event RequestVoteCast(
        uint256 indexed requestId,
        uint256 indexed ambassadorId,
        bool votedApprove,
        uint256 seedsEarned
    );

    event RequestResolved(
        uint256 indexed requestId,
        bool approved,
        uint256 totalVotes
    );

    event RequestAdminResolved(
        uint256 indexed requestId,
        bool approved,
        string reason
    );

    event DataExportUploaded(
        uint256 indexed requestId,
        string dataExportIpfs
    );

    // Admin events
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(isAdmin[_msgSender()], "Not an admin");
        _;
    }

    modifier canVoteOnRequests() {
        uint256 ambassadorId = ambassadorRewards.ambassadorIdByWallet(_msgSender());
        require(ambassadorId != 0, "Not an ambassador");

        IAmbassadorRewardsForGov.Ambassador memory amb = ambassadorRewards.getAmbassador(ambassadorId);
        require(amb.active, "Not active");
        require(!amb.suspended, "Suspended");
        require(amb.recruitedSellers >= 1, "Must have 1+ recruited seller");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _ambassadorRewards,
        address _trustedForwarder,
        address _initialAdmin
    ) ERC2771Context(_trustedForwarder) {
        require(_ambassadorRewards != address(0), "Invalid ambassador rewards");
        require(_initialAdmin != address(0), "Invalid admin");

        ambassadorRewards = IAmbassadorRewardsForGov(_ambassadorRewards);

        admins.push(_initialAdmin);
        isAdmin[_initialAdmin] = true;
    }

    // ============ Core Functions ============

    /**
     * @notice Submit a government data request
     * @param agencyName Name of the government agency
     * @param agencyEmail Official email address
     * @param jurisdiction State or "Federal"
     * @param requestType "food_safety" or "other"
     * @param justification Why the data is needed
     * @param credentialsIpfs IPFS hash of supporting documentation
     */
    function submitRequest(
        string calldata agencyName,
        string calldata agencyEmail,
        string calldata jurisdiction,
        string calldata requestType,
        string calldata justification,
        string calldata credentialsIpfs
    ) external returns (uint256 requestId) {
        require(bytes(agencyName).length > 0, "Agency name required");
        require(bytes(agencyEmail).length > 0, "Agency email required");
        require(bytes(justification).length >= 50, "Justification too short");

        // Check agency cooldown
        uint256 lastRequest = agencyLastRequest[agencyName];
        require(
            lastRequest == 0 || block.timestamp >= lastRequest + REQUEST_COOLDOWN,
            "Agency cooldown not expired"
        );

        requestId = ++nextRequestId;

        requests[requestId] = DataRequest({
            requester: _msgSender(),
            agencyName: agencyName,
            agencyEmail: agencyEmail,
            jurisdiction: jurisdiction,
            requestType: requestType,
            justification: justification,
            credentialsIpfs: credentialsIpfs,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + VOTE_DURATION,
            votesApprove: 0,
            votesDeny: 0,
            resolved: false,
            approved: false,
            dataExportIpfs: "",
            adminResolved: false,
            adminReason: ""
        });

        agencyLastRequest[agencyName] = block.timestamp;

        emit RequestSubmitted(requestId, _msgSender(), agencyName, jurisdiction, requestType);
    }

    /**
     * @notice Ambassador votes on a government request
     */
    function voteOnRequest(uint256 requestId, bool approve) external canVoteOnRequests nonReentrant {
        DataRequest storage request = requests[requestId];
        require(request.createdAt != 0, "Request does not exist");
        require(!request.resolved, "Request already resolved");
        require(block.timestamp <= request.votingEndsAt, "Voting period ended");

        uint256 ambassadorId = ambassadorRewards.ambassadorIdByWallet(_msgSender());
        require(!requestVotes[requestId][ambassadorId], "Already voted");

        // Record vote
        requestVotes[requestId][ambassadorId] = true;
        requestVoteChoice[requestId][ambassadorId] = approve;

        if (approve) {
            request.votesApprove++;
        } else {
            request.votesDeny++;
        }

        emit RequestVoteCast(requestId, ambassadorId, approve, SEEDS_PER_VOTE);
    }

    /**
     * @notice Resolve request after voting period ends
     */
    function resolveRequest(uint256 requestId) external nonReentrant {
        DataRequest storage request = requests[requestId];
        require(request.createdAt != 0, "Request does not exist");
        require(!request.resolved, "Already resolved");
        require(block.timestamp > request.votingEndsAt, "Voting still active");

        uint256 totalVotes = request.votesApprove + request.votesDeny;

        request.resolved = true;

        // Need quorum AND majority to approve
        if (totalVotes >= MIN_VOTES_REQUIRED && request.votesApprove > request.votesDeny) {
            request.approved = true;
        } else {
            request.approved = false;
        }

        emit RequestResolved(requestId, request.approved, totalVotes);
    }

    /**
     * @notice Admin resolves request directly
     */
    function adminResolveRequest(
        uint256 requestId,
        bool approve,
        string calldata reason
    ) external onlyAdmin {
        DataRequest storage request = requests[requestId];
        require(request.createdAt != 0, "Request does not exist");
        require(!request.resolved, "Already resolved");

        request.resolved = true;
        request.approved = approve;
        request.adminResolved = true;
        request.adminReason = reason;

        emit RequestAdminResolved(requestId, approve, reason);
    }

    /**
     * @notice Admin uploads data export after approval
     */
    function uploadDataExport(uint256 requestId, string calldata dataExportIpfs) external onlyAdmin {
        DataRequest storage request = requests[requestId];
        require(request.createdAt != 0, "Request does not exist");
        require(request.resolved, "Request not resolved");
        require(request.approved, "Request not approved");
        require(bytes(request.dataExportIpfs).length == 0, "Export already uploaded");

        request.dataExportIpfs = dataExportIpfs;

        emit DataExportUploaded(requestId, dataExportIpfs);
    }

    // ============ View Functions ============

    function getRequest(uint256 requestId) external view returns (DataRequest memory) {
        return requests[requestId];
    }

    function hasVotedOnRequest(uint256 requestId, uint256 ambassadorId) external view returns (bool) {
        return requestVotes[requestId][ambassadorId];
    }

    function getActiveRequests() external view returns (uint256[] memory) {
        // Count active requests first
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= nextRequestId; i++) {
            if (!requests[i].resolved) {
                activeCount++;
            }
        }

        // Populate array
        uint256[] memory activeIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= nextRequestId; i++) {
            if (!requests[i].resolved) {
                activeIds[index] = i;
                index++;
            }
        }

        return activeIds;
    }

    function getAllRequests() external view returns (uint256[] memory) {
        uint256[] memory allIds = new uint256[](nextRequestId);
        for (uint256 i = 1; i <= nextRequestId; i++) {
            allIds[i - 1] = i;
        }
        return allIds;
    }

    function getQualifiedVoterCount() external view returns (uint256) {
        uint256 count = 0;
        uint256 totalAmbassadors = ambassadorRewards.nextAmbassadorId();

        for (uint256 i = 1; i <= totalAmbassadors; i++) {
            IAmbassadorRewardsForGov.Ambassador memory amb = ambassadorRewards.getAmbassador(i);
            if (amb.active && !amb.suspended && amb.recruitedSellers >= 1) {
                count++;
            }
        }

        return count;
    }

    // ============ Admin Functions ============

    function addAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        require(!isAdmin[_newAdmin], "Already an admin");

        admins.push(_newAdmin);
        isAdmin[_newAdmin] = true;

        emit AdminAdded(_newAdmin, _msgSender());
    }

    function removeAdmin(address _admin) external onlyAdmin {
        require(isAdmin[_admin], "Not an admin");
        require(admins.length > 1, "Cannot remove last admin");

        isAdmin[_admin] = false;

        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        emit AdminRemoved(_admin, _msgSender());
    }

    function getAdmins() external view returns (address[] memory) {
        return admins;
    }

    /**
     * @notice Update ambassador rewards address (admin only)
     */
    function updateAmbassadorRewards(address _ambassadorRewards) external onlyAdmin {
        require(_ambassadorRewards != address(0), "Invalid ambassador rewards");
        ambassadorRewards = IAmbassadorRewardsForGov(_ambassadorRewards);
    }
}
