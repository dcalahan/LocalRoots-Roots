// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./interfaces/IDisputeResolution.sol";

/**
 * @title IAmbassadorRewardsForDisputes
 * @notice Minimal interface for ambassador data needed by dispute resolution
 */
interface IAmbassadorRewardsForDisputes {
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

    struct SellerRecruitment {
        uint256 ambassadorId;
        uint256 recruitedAt;
        uint256 totalSalesVolume;
        uint256 totalRewardsPaid;
        uint256 completedOrderCount;
        uint256 uniqueBuyerCount;
        bool activated;
    }

    function ambassadorIdByWallet(address wallet) external view returns (uint256);
    function getAmbassador(uint256 ambassadorId) external view returns (Ambassador memory);
    function getSellerRecruitment(uint256 sellerId) external view returns (SellerRecruitment memory);
    function getActivatedSellerCount(uint256 ambassadorId) external view returns (uint256);
    function nextAmbassadorId() external view returns (uint256);
}

/**
 * @title IMarketplaceForDisputes
 * @notice Minimal interface for marketplace functions needed by dispute resolution
 */
interface IMarketplaceForDisputes {
    function executeDisputeResolution(uint256 orderId, bool buyerWins) external;
    function suspendSeller(uint256 sellerId, string calldata reason) external;
    function sellers(uint256 sellerId) external view returns (
        address owner,
        bytes8 geohash,
        string memory storefrontIpfs,
        bool offersDelivery,
        bool offersPickup,
        uint256 deliveryRadiusKm,
        uint256 createdAt,
        bool active
    );
}

/**
 * @title DisputeResolution
 * @notice Ambassador voting on order disputes
 * @dev Separate from marketplace for clean separation of concerns
 *
 * Flow:
 * 1. Buyer raises dispute in marketplace -> marketplace calls openDispute()
 * 2. Seller submits response with evidence
 * 3. Ambassadors vote during 72h window (must have 1+ activated seller to vote)
 * 4. After voting ends: resolve based on majority (min 5 votes)
 * 5. If no quorum: extend 48h, then auto-refund buyer
 *
 * Anti-Sybil: Ambassadors must have recruited at least 1 seller who has
 * completed 2+ orders from 2+ unique buyers. This ensures real skin in the game.
 */
contract DisputeResolution is IDisputeResolution, ReentrancyGuard, ERC2771Context {

    // ============ State Variables ============

    IAmbassadorRewardsForDisputes public ambassadorRewards;
    IMarketplaceForDisputes public marketplace;

    // Admin management
    address[] public admins;
    mapping(address => bool) public isAdmin;

    // Early-stage whitelist - bypasses "activated seller" requirement for voting
    // Used during early growth when not enough qualified voters exist
    // Should be emptied when platform has sufficient qualified ambassadors
    mapping(address => bool) public whitelistedVoters;

    // ============ Constants ============

    uint256 public constant VOTE_DURATION = 3 days;
    uint256 public constant VOTE_EXTENSION = 2 days;
    uint256 public constant SELLER_RESPONSE_WINDOW = 36 hours; // Seller must respond within 36h of dispute opening
    uint256 public constant MIN_VOTES_REQUIRED = 5;
    uint256 public constant SELLER_STRIKE_LIMIT = 3;
    uint256 public constant BUYER_STRIKE_LIMIT = 3;
    uint256 public constant SEEDS_PER_VOTE = 100 * 1e6;      // 100 Seeds (6 decimals like USDC)
    uint256 public constant SEEDS_MAJORITY_BONUS = 50 * 1e6; // 50 Seeds bonus

    // ============ Storage ============

    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(uint256 => bool)) public disputeVotes; // disputeId => ambassadorId => hasVoted
    mapping(uint256 => mapping(uint256 => bool)) public disputeVoteChoice; // disputeId => ambassadorId => votedForBuyer
    mapping(uint256 => mapping(uint256 => string)) public disputeVoteReasons; // disputeId => ambassadorId => reason
    mapping(address => UserStrikes) public userStrikes;
    // Strikes tracked by sellerId so a sin-binned seller can't dodge by re-registering with a fresh wallet.
    mapping(uint256 => uint256) public sellerStrikesById;
    mapping(uint256 => uint256) public orderToDispute; // orderId => disputeId

    // ============ Events ============

    event DisputeOpened(
        uint256 indexed disputeId,
        uint256 indexed orderId,
        address indexed buyer,
        uint256 sellerId,
        string reason
    );

    event SellerResponseSubmitted(
        uint256 indexed disputeId,
        uint256 indexed sellerId,
        string response
    );

    event DisputeVoteCast(
        uint256 indexed disputeId,
        uint256 indexed ambassadorId,
        bool votedForBuyer,
        string reason,
        uint256 seedsEarned
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed orderId,
        bool buyerWon,
        uint256 totalVotes
    );

    event DisputeAdminResolved(
        uint256 indexed disputeId,
        bool buyerWon,
        string reason
    );

    event DisputeExtended(
        uint256 indexed disputeId,
        uint256 newVotingEndsAt
    );

    event StrikeAdded(
        address indexed user,
        bool isSeller,
        uint256 totalStrikes
    );

    event SellerAutoSuspended(
        uint256 indexed sellerId,
        uint256 strikeCount
    );

    // Admin events
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);

    // Whitelist events
    event VoterWhitelisted(address indexed voter, address indexed addedBy);
    event VoterRemovedFromWhitelist(address indexed voter, address indexed removedBy);

    // ============ Modifiers ============

    modifier onlyMarketplace() {
        require(msg.sender == address(marketplace), "Only marketplace");
        _;
    }

    modifier onlyAdmin() {
        require(isAdmin[_msgSender()], "Not an admin");
        _;
    }

    modifier canVoteOnDisputes() {
        uint256 ambassadorId = ambassadorRewards.ambassadorIdByWallet(_msgSender());
        require(ambassadorId != 0, "Not an ambassador");

        IAmbassadorRewardsForDisputes.Ambassador memory amb = ambassadorRewards.getAmbassador(ambassadorId);
        require(amb.active, "Not active");
        require(!amb.suspended, "Suspended");

        // WHITELIST BYPASS: Skip recruited/activated seller check for early-stage trusted voters
        if (!whitelistedVoters[_msgSender()]) {
            require(amb.recruitedSellers >= 1, "Must have 1+ recruited seller");
            require(_hasActivatedSeller(ambassadorId), "Must have 1+ activated seller to vote");
        }
        _;
    }

    // ============ Constructor ============

    constructor(
        address _ambassadorRewards,
        address _marketplace,
        address _trustedForwarder,
        address _initialAdmin
    ) ERC2771Context(_trustedForwarder) {
        require(_ambassadorRewards != address(0), "Invalid ambassador rewards");
        require(_marketplace != address(0), "Invalid marketplace");
        require(_initialAdmin != address(0), "Invalid admin");

        ambassadorRewards = IAmbassadorRewardsForDisputes(_ambassadorRewards);
        marketplace = IMarketplaceForDisputes(_marketplace);

        admins.push(_initialAdmin);
        isAdmin[_initialAdmin] = true;
    }

    // ============ Core Functions ============

    /**
     * @notice Open a dispute for an order (called by marketplace)
     */
    function openDispute(
        uint256 orderId,
        address buyer,
        uint256 sellerId,
        string calldata reason,
        string calldata evidenceIpfs
    ) external onlyMarketplace returns (uint256 disputeId) {
        require(orderToDispute[orderId] == 0, "Dispute already exists");

        disputeId = ++nextDisputeId;

        disputes[disputeId] = Dispute({
            orderId: orderId,
            buyer: buyer,
            sellerId: sellerId,
            buyerReason: reason,
            buyerEvidenceIpfs: evidenceIpfs,
            sellerResponse: "",
            sellerEvidenceIpfs: "",
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + VOTE_DURATION,
            votesForBuyer: 0,
            votesForSeller: 0,
            resolved: false,
            buyerWon: false,
            extended: false,
            adminResolved: false,
            adminReason: ""
        });

        orderToDispute[orderId] = disputeId;

        emit DisputeOpened(disputeId, orderId, buyer, sellerId, reason);
    }

    /**
     * @notice Seller submits response to dispute
     */
    function submitSellerResponse(
        uint256 disputeId,
        string calldata response,
        string calldata evidenceIpfs
    ) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.orderId != 0, "Dispute does not exist");
        require(!dispute.resolved, "Dispute already resolved");
        require(bytes(dispute.sellerResponse).length == 0, "Response already submitted");
        require(
            block.timestamp <= dispute.createdAt + SELLER_RESPONSE_WINDOW,
            "Response window expired"
        );

        // Verify caller is the seller
        (address sellerOwner,,,,,,,) = marketplace.sellers(dispute.sellerId);
        require(_msgSender() == sellerOwner, "Not the seller");

        dispute.sellerResponse = response;
        dispute.sellerEvidenceIpfs = evidenceIpfs;

        emit SellerResponseSubmitted(disputeId, dispute.sellerId, response);
    }

    /**
     * @notice Ambassador casts vote on dispute
     * @param disputeId The dispute to vote on
     * @param voteForBuyer True to side with buyer, false to side with seller
     * @param reason Required explanation for the vote (min 20 characters)
     */
    function vote(uint256 disputeId, bool voteForBuyer, string calldata reason) external canVoteOnDisputes nonReentrant {
        require(bytes(reason).length >= 20, "Reason must be at least 20 characters");

        Dispute storage dispute = disputes[disputeId];
        require(dispute.orderId != 0, "Dispute does not exist");
        require(!dispute.resolved, "Dispute already resolved");
        require(block.timestamp <= dispute.votingEndsAt, "Voting period ended");

        uint256 ambassadorId = ambassadorRewards.ambassadorIdByWallet(_msgSender());
        require(!disputeVotes[disputeId][ambassadorId], "Already voted");

        // Record vote
        disputeVotes[disputeId][ambassadorId] = true;
        disputeVoteChoice[disputeId][ambassadorId] = voteForBuyer;
        disputeVoteReasons[disputeId][ambassadorId] = reason;

        if (voteForBuyer) {
            dispute.votesForBuyer++;
        } else {
            dispute.votesForSeller++;
        }

        // Base Seeds reward for voting
        emit DisputeVoteCast(disputeId, ambassadorId, voteForBuyer, reason, SEEDS_PER_VOTE);
    }

    /**
     * @notice Get the reason for an ambassador's vote
     */
    function getVoteReason(uint256 disputeId, uint256 ambassadorId) external view returns (string memory) {
        return disputeVoteReasons[disputeId][ambassadorId];
    }

    /**
     * @notice Resolve dispute after voting period ends
     */
    function resolveDispute(uint256 disputeId) external nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.orderId != 0, "Dispute does not exist");
        require(!dispute.resolved, "Already resolved");
        require(block.timestamp > dispute.votingEndsAt, "Voting still active");

        uint256 totalVotes = dispute.votesForBuyer + dispute.votesForSeller;

        if (totalVotes < MIN_VOTES_REQUIRED) {
            if (!dispute.extended) {
                // Extend voting by 48 hours
                dispute.extended = true;
                dispute.votingEndsAt = block.timestamp + VOTE_EXTENSION;
                emit DisputeExtended(disputeId, dispute.votingEndsAt);
                return;
            } else {
                // Already extended, no quorum - auto-refund buyer (safer default)
                dispute.resolved = true;
                dispute.buyerWon = true;
                _addSellerStrike(dispute.sellerId);
                marketplace.executeDisputeResolution(dispute.orderId, true);
                emit DisputeResolved(disputeId, dispute.orderId, true, totalVotes);
                return;
            }
        }

        // Quorum reached - majority wins
        dispute.resolved = true;
        dispute.buyerWon = dispute.votesForBuyer > dispute.votesForSeller;

        if (dispute.buyerWon) {
            _addSellerStrike(dispute.sellerId);
        } else {
            // Seller won - check if this was frivolous
            // If overwhelming seller vote (>80%), add buyer strike
            if (dispute.votesForSeller > dispute.votesForBuyer * 4) {
                _addBuyerStrike(dispute.buyer);
            }
        }

        // Execute resolution in marketplace
        marketplace.executeDisputeResolution(dispute.orderId, dispute.buyerWon);

        emit DisputeResolved(disputeId, dispute.orderId, dispute.buyerWon, totalVotes);
    }

    /**
     * @notice Admin resolves dispute directly (for early stage or urgent cases)
     * @dev TEMPORARY — must be removed at $ROOTS token launch per the decentralization
     *      principle in CLAUDE.md. The voter whitelist (addWhitelistedVoter) is the
     *      decentralized replacement: trusted early voters cast normal votes that count
     *      toward quorum, eliminating the need for admin overrides.
     */
    function adminResolveDispute(
        uint256 disputeId,
        bool buyerWins,
        string calldata reason
    ) external onlyAdmin {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.orderId != 0, "Dispute does not exist");
        require(!dispute.resolved, "Already resolved");

        dispute.resolved = true;
        dispute.buyerWon = buyerWins;
        dispute.adminResolved = true;
        dispute.adminReason = reason;

        // Execute resolution
        marketplace.executeDisputeResolution(dispute.orderId, buyerWins);

        // Apply strikes if appropriate
        if (buyerWins) {
            _addSellerStrike(dispute.sellerId);
        }

        emit DisputeAdminResolved(disputeId, buyerWins, reason);
    }

    // ============ Strike System ============

    function _addSellerStrike(uint256 sellerId) internal {
        (address sellerOwner,,,,,,,) = marketplace.sellers(sellerId);

        // Track by both wallet AND sellerId. The sellerId-based count is the authoritative
        // suspension trigger so a malicious seller can't dodge strikes by switching wallets
        // and re-registering — though note: a fresh sellerId from the same wallet is still
        // protected by the wallet-based count below.
        UserStrikes storage strikes = userStrikes[sellerOwner];
        strikes.sellerStrikes++;
        strikes.lastStrikeAt = block.timestamp;

        sellerStrikesById[sellerId]++;

        emit StrikeAdded(sellerOwner, true, strikes.sellerStrikes);

        // Auto-suspend after 3 strikes (whichever counter trips first)
        if (sellerStrikesById[sellerId] >= SELLER_STRIKE_LIMIT ||
            strikes.sellerStrikes >= SELLER_STRIKE_LIMIT) {
            marketplace.suspendSeller(sellerId, "Auto-suspended: 3 dispute strikes");
            emit SellerAutoSuspended(sellerId, sellerStrikesById[sellerId]);
        }
    }

    function _addBuyerStrike(address buyer) internal {
        UserStrikes storage strikes = userStrikes[buyer];
        strikes.buyerStrikes++;
        strikes.lastStrikeAt = block.timestamp;

        emit StrikeAdded(buyer, false, strikes.buyerStrikes);
    }

    // ============ Anti-Sybil Helper ============

    /**
     * @notice Check if ambassador has at least one activated seller
     * @dev A seller is activated after 2 completed orders from 2 unique buyers.
     *      Real anti-Sybil gate: queries the indexed activated count from AmbassadorRewards.
     */
    function _hasActivatedSeller(uint256 ambassadorId) internal view returns (bool) {
        return ambassadorRewards.getActivatedSellerCount(ambassadorId) >= 1;
    }

    // ============ View Functions ============

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function hasVoted(uint256 disputeId, uint256 ambassadorId) external view returns (bool) {
        return disputeVotes[disputeId][ambassadorId];
    }

    function getUserStrikes(address user) external view returns (UserStrikes memory) {
        return userStrikes[user];
    }

    /// @notice Count qualified voters within a paginated range of ambassador IDs.
    /// @dev Use getQualifiedVoterCountTotal() for headcount estimates without iteration in callers.
    function getQualifiedVoterCount(uint256 startId, uint256 limit) external view returns (uint256) {
        uint256 count = 0;
        uint256 totalAmbassadors = ambassadorRewards.nextAmbassadorId();
        if (startId == 0) startId = 1;
        uint256 endId = startId + limit - 1;
        if (endId > totalAmbassadors) endId = totalAmbassadors;

        for (uint256 i = startId; i <= endId; i++) {
            IAmbassadorRewardsForDisputes.Ambassador memory amb = ambassadorRewards.getAmbassador(i);
            if (amb.active && !amb.suspended && amb.recruitedSellers >= 1) {
                count++;
            }
        }

        return count;
    }

    function getDisputeByOrder(uint256 orderId) external view returns (Dispute memory) {
        uint256 disputeId = orderToDispute[orderId];
        require(disputeId != 0, "No dispute for order");
        return disputes[disputeId];
    }

    /// @notice Paginated open dispute lookup. Pass startId=0 to start at the beginning.
    /// @dev Scans dispute IDs in [startId, startId+limit-1]. Frontend should page until empty.
    function getOpenDisputes(uint256 startId, uint256 limit) external view returns (uint256[] memory) {
        if (startId == 0) startId = 1;
        uint256 endId = startId + limit - 1;
        if (endId > nextDisputeId) endId = nextDisputeId;

        // Count open disputes in window first
        uint256 openCount = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (!disputes[i].resolved) {
                openCount++;
            }
        }

        uint256[] memory openDisputeIds = new uint256[](openCount);
        uint256 index = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (!disputes[i].resolved) {
                openDisputeIds[index] = i;
                index++;
            }
        }

        return openDisputeIds;
    }

    // ============ Whitelist Functions ============

    /**
     * @notice Add address to voter whitelist (bypasses activated seller requirement)
     * @dev Used during early stage when not enough qualified voters exist
     */
    function addWhitelistedVoter(address voter) external onlyAdmin {
        whitelistedVoters[voter] = true;
        emit VoterWhitelisted(voter, _msgSender());
    }

    /**
     * @notice Remove address from voter whitelist
     */
    function removeWhitelistedVoter(address voter) external onlyAdmin {
        whitelistedVoters[voter] = false;
        emit VoterRemovedFromWhitelist(voter, _msgSender());
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
     * @notice Update marketplace address (admin only)
     */
    function updateMarketplace(address _marketplace) external onlyAdmin {
        require(_marketplace != address(0), "Invalid marketplace");
        marketplace = IMarketplaceForDisputes(_marketplace);
    }

    /**
     * @notice Update ambassador rewards address (admin only)
     */
    function updateAmbassadorRewards(address _ambassadorRewards) external onlyAdmin {
        require(_ambassadorRewards != address(0), "Invalid ambassador rewards");
        ambassadorRewards = IAmbassadorRewardsForDisputes(_ambassadorRewards);
    }
}
