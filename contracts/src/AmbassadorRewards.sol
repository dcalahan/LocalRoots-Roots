// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title AmbassadorRewards
 * @notice Chain-based referral rewards for LocalRoots ambassadors
 * @dev Compensation model:
 *      - 25% of each sale goes to ambassador pool (from treasury)
 *      - 80/20 split at each level (recruiter keeps 80%, passes 20% up)
 *      - Chain walks up until State Founder (uplineId = 0)
 *
 *      Example for 4-level chain on $100 sale (25 ROOTS pool):
 *        Block Ambassador (recruited seller): 20 ROOTS (80%)
 *        Neighborhood Ambassador: 4 ROOTS (80% of 5)
 *        City Ambassador: 0.8 ROOTS (80% of 1)
 *        State Founder: 0.2 ROOTS (keeps remainder)
 *
 *      FRAUD PROTECTION:
 *      - Rewards vest over 7 days (can be clawed back if disputed)
 *      - Ambassador governance can vote to suspend bad actors
 *      - Seller activation: 2 orders from 2 unique buyers required
 *
 *      CIRCUIT BREAKERS:
 *      - Daily treasury outflow cap: 0.5% of initial treasury per day
 *      - Ambassador weekly cap: 10,000 ROOTS per ambassador per week
 *      - New ambassador cooldown: 24 hours before rewards activate
 */
contract AmbassadorRewards is ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable rootsToken;
    address public marketplace;
    address public admin;  // Legacy single admin (kept for backwards compatibility)

    // Multi-admin support
    address[] public admins;
    mapping(address => bool) public isAdminMap;

    // Reward distribution parameters
    uint256 public constant TOTAL_REWARD_BPS = 2500;      // 25% of sale to ambassador pool
    uint256 public constant UPLINE_SHARE_BPS = 2000;      // 20% passed up at each level
    uint256 public constant RECRUITER_KEEP_BPS = 8000;    // 80% kept by each level
    uint256 public constant MAX_CHAIN_DEPTH = 10;         // Safety limit on chain walking

    // Timing parameters
    uint256 public constant REWARD_DURATION = 365 days;   // 1 year reward period per seller
    uint256 public constant VESTING_PERIOD = 7 days;      // Rewards vest over 7 days

    // Governance parameters
    uint256 public constant VOTE_DURATION = 3 days;
    uint256 public constant MIN_VOTES_REQUIRED = 3;

    // Circuit breaker parameters
    uint256 public constant DAILY_OUTFLOW_BPS = 50;       // 0.5% of initial treasury per day
    uint256 public constant AMBASSADOR_WEEKLY_CAP = 10_000 * 10**18;  // 10,000 ROOTS per week
    uint256 public constant AMBASSADOR_COOLDOWN = 24 hours;
    uint256 public constant SELLER_MIN_ORDERS = 2;
    uint256 public constant SELLER_MIN_UNIQUE_BUYERS = 2;

    uint256 public nextAmbassadorId;
    uint256 public nextPendingRewardId;
    uint256 public nextFlagId;

    // Circuit breaker state
    uint256 public initialTreasuryBalance;
    bool public treasuryInitialized;

    // ============ Structs ============

    struct Ambassador {
        address wallet;
        uint256 uplineId;           // 0 = State Founder (top of chain)
        uint256 totalEarned;
        uint256 totalPending;
        uint256 recruitedSellers;
        uint256 recruitedAmbassadors;
        uint256 createdAt;
        bool active;
        bool suspended;
        bytes8 regionGeohash;       // For State Founders: the region they own (e.g., state prefix)
        string profileIpfs;         // IPFS hash for ambassador profile (name, bio, etc.)
    }

    struct SellerRecruitment {
        uint256 ambassadorId;       // Ambassador who recruited this seller
        uint256 recruitedAt;
        uint256 totalSalesVolume;
        uint256 totalRewardsPaid;
        uint256 completedOrderCount;
        uint256 uniqueBuyerCount;
        bool activated;             // Met activation threshold (2 orders, 2 unique buyers)
    }

    struct PendingReward {
        uint256 orderId;
        uint256 sellerId;
        uint256 queuedAt;
        uint256 vestingEndsAt;
        uint256 totalAmount;        // Total pool for this sale
        bool claimed;
        bool clawedBack;
        // Chain payouts stored separately
    }

    struct ChainPayout {
        uint256 pendingRewardId;
        uint256 ambassadorId;
        uint256 amount;
        bool claimed;
    }

    struct FraudFlag {
        uint256 targetAmbassadorId;
        uint256 flaggedBy;
        string reason;
        uint256 createdAt;
        uint256 votesFor;
        uint256 votesAgainst;
        bool resolved;
        bool suspended;
    }

    // ============ Mappings ============

    mapping(uint256 => Ambassador) public ambassadors;
    mapping(address => uint256) public ambassadorIdByWallet;
    mapping(uint256 => SellerRecruitment) public sellerRecruitments;
    mapping(uint256 => PendingReward) public pendingRewards;
    mapping(uint256 => FraudFlag) public fraudFlags;
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;

    // Chain payouts for each pending reward
    mapping(uint256 => ChainPayout[]) public rewardPayouts;  // pendingRewardId => payouts
    mapping(uint256 => uint256[]) public ambassadorPendingRewards;  // ambassadorId => pendingRewardIds

    // Circuit breaker tracking
    mapping(uint256 => uint256) public dailyOutflow;
    mapping(uint256 => mapping(uint256 => uint256)) public ambassadorWeeklyRewards;
    mapping(uint256 => mapping(address => bool)) public sellerBuyers;

    // ============ Events ============

    event StateFounderRegistered(uint256 indexed ambassadorId, address indexed wallet, bytes8 regionGeohash);
    event AmbassadorRegistered(uint256 indexed ambassadorId, address indexed wallet, uint256 indexed uplineId);
    event SellerRecruited(uint256 indexed sellerId, uint256 indexed ambassadorId);
    event SellerActivated(uint256 indexed sellerId, uint256 indexed ambassadorId);
    event RewardQueued(
        uint256 indexed pendingRewardId,
        uint256 indexed orderId,
        uint256 totalAmount,
        uint256 chainDepth
    );
    event ChainPayoutQueued(
        uint256 indexed pendingRewardId,
        uint256 indexed ambassadorId,
        uint256 amount,
        uint256 level
    );
    event RewardClaimed(uint256 indexed pendingRewardId, uint256 indexed ambassadorId, uint256 amount);
    event RewardClawedBack(uint256 indexed pendingRewardId, uint256 indexed orderId, string reason);
    event FraudFlagRaised(uint256 indexed flagId, uint256 indexed targetAmbassadorId, uint256 indexed flaggedBy);
    event VoteCast(uint256 indexed flagId, uint256 indexed ambassadorId, bool voteToSuspend);
    event FraudFlagResolved(uint256 indexed flagId, uint256 indexed targetAmbassadorId, bool suspended);
    event AmbassadorSuspended(uint256 indexed ambassadorId);
    event DailyCapReached(uint256 indexed day, uint256 amount);
    event WeeklyCapReached(uint256 indexed ambassadorId, uint256 indexed week, uint256 amount);
    event TreasuryInitialized(uint256 amount);
    event ProfileUpdated(uint256 indexed ambassadorId, string profileIpfs);
    event MarketplaceUpdated(address indexed marketplace);

    // ============ Modifiers ============

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Only marketplace");
        _;
    }

    modifier onlyAdmin() {
        require(isAdminMap[msg.sender] || msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyActiveAmbassador() {
        uint256 ambassadorId = ambassadorIdByWallet[_msgSender()];
        require(ambassadorId != 0, "Not an ambassador");
        require(ambassadors[ambassadorId].active, "Ambassador not active");
        require(!ambassadors[ambassadorId].suspended, "Ambassador suspended");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _rootsToken,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) {
        require(_rootsToken != address(0), "Invalid token address");
        rootsToken = IERC20(_rootsToken);
        admin = msg.sender;  // Deployer is admin - intentionally msg.sender, not _msgSender()

        // Initialize multi-admin array with deployer
        admins.push(msg.sender);
        isAdminMap[msg.sender] = true;
    }

    // ============ Admin Functions ============

    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "Marketplace already set");
        require(_marketplace != address(0), "Invalid marketplace address");
        marketplace = _marketplace;
    }

    /**
     * @notice Update the marketplace address (admin only)
     * @param _marketplace New marketplace contract address
     */
    function updateMarketplace(address _marketplace) external onlyAdmin {
        require(_marketplace != address(0), "Invalid marketplace address");
        marketplace = _marketplace;
        emit MarketplaceUpdated(_marketplace);
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admin = _newAdmin;
    }

    /**
     * @notice Add a new admin
     * @param _newAdmin Address to grant admin rights
     */
    function addAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        require(!isAdminMap[_newAdmin], "Already an admin");

        admins.push(_newAdmin);
        isAdminMap[_newAdmin] = true;
    }

    /**
     * @notice Remove an admin
     * @param _admin Address to revoke admin rights
     */
    function removeAdmin(address _admin) external onlyAdmin {
        require(isAdminMap[_admin], "Not an admin");
        require(admins.length > 1, "Cannot remove last admin");

        isAdminMap[_admin] = false;

        // Remove from array
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }
    }

    /**
     * @notice Get all admin addresses
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }

    /**
     * @notice Directly suspend an ambassador (bypasses governance vote)
     * @param _ambassadorId Ambassador to suspend
     * @param _reason Reason for suspension
     */
    function adminSuspendAmbassador(uint256 _ambassadorId, string calldata _reason) external onlyAdmin {
        require(ambassadors[_ambassadorId].wallet != address(0), "Ambassador does not exist");
        require(!ambassadors[_ambassadorId].suspended, "Already suspended");

        ambassadors[_ambassadorId].suspended = true;
        _clawbackAllPending(_ambassadorId);

        emit AmbassadorSuspended(_ambassadorId);
    }

    function initializeTreasury() external {
        require(!treasuryInitialized, "Already initialized");
        uint256 balance = rootsToken.balanceOf(address(this));
        require(balance > 0, "No treasury balance");

        initialTreasuryBalance = balance;
        treasuryInitialized = true;

        emit TreasuryInitialized(balance);
    }

    // ============ State Founder Registration ============

    /**
     * @notice Register a State Founder (top of chain, no upline)
     * @dev Only admin can register State Founders
     * @param _wallet Address of the State Founder
     * @param _regionGeohash Geohash prefix for their region (e.g., first 2-3 chars for state)
     * @param _profileIpfs IPFS hash for ambassador profile
     */
    function registerStateFounder(
        address _wallet,
        bytes8 _regionGeohash,
        string calldata _profileIpfs
    ) external onlyAdmin returns (uint256 ambassadorId) {
        require(ambassadorIdByWallet[_wallet] == 0, "Already an ambassador");

        ambassadorId = ++nextAmbassadorId;

        ambassadors[ambassadorId] = Ambassador({
            wallet: _wallet,
            uplineId: 0,  // No upline = State Founder
            totalEarned: 0,
            totalPending: 0,
            recruitedSellers: 0,
            recruitedAmbassadors: 0,
            createdAt: block.timestamp,
            active: true,
            suspended: false,
            regionGeohash: _regionGeohash,
            profileIpfs: _profileIpfs
        });

        ambassadorIdByWallet[_wallet] = ambassadorId;

        emit StateFounderRegistered(ambassadorId, _wallet, _regionGeohash);
    }

    // ============ Ambassador Registration ============

    /**
     * @notice Register as an ambassador under an existing ambassador
     * @param _uplineId The ambassador who recruited you (must be active)
     * @param _profileIpfs IPFS hash for ambassador profile (name, bio, etc.)
     */
    function registerAmbassador(uint256 _uplineId, string calldata _profileIpfs) external returns (uint256 ambassadorId) {
        require(ambassadorIdByWallet[_msgSender()] == 0, "Already an ambassador");
        require(_uplineId != 0, "Must have an upline (use registerStateFounder for founders)");
        require(ambassadors[_uplineId].active, "Upline not active");
        require(!ambassadors[_uplineId].suspended, "Upline suspended");

        ambassadors[_uplineId].recruitedAmbassadors++;

        ambassadorId = ++nextAmbassadorId;

        ambassadors[ambassadorId] = Ambassador({
            wallet: _msgSender(),
            uplineId: _uplineId,
            totalEarned: 0,
            totalPending: 0,
            recruitedSellers: 0,
            recruitedAmbassadors: 0,
            createdAt: block.timestamp,
            active: true,
            suspended: false,
            regionGeohash: bytes8(0),  // Only State Founders have regions
            profileIpfs: _profileIpfs
        });

        ambassadorIdByWallet[_msgSender()] = ambassadorId;

        emit AmbassadorRegistered(ambassadorId, _msgSender(), _uplineId);
    }

    /**
     * @notice Update ambassador profile
     * @param _profileIpfs New IPFS hash for ambassador profile
     */
    function updateProfile(string calldata _profileIpfs) external {
        uint256 ambassadorId = ambassadorIdByWallet[_msgSender()];
        require(ambassadorId != 0, "Not an ambassador");
        require(ambassadors[ambassadorId].active, "Ambassador not active");

        ambassadors[ambassadorId].profileIpfs = _profileIpfs;

        emit ProfileUpdated(ambassadorId, _profileIpfs);
    }

    // ============ Seller Recruitment ============

    function recordSellerRecruitment(
        uint256 _sellerId,
        uint256 _ambassadorId
    ) external onlyMarketplace {
        require(ambassadors[_ambassadorId].active, "Ambassador not active");
        require(!ambassadors[_ambassadorId].suspended, "Ambassador suspended");
        require(sellerRecruitments[_sellerId].ambassadorId == 0, "Seller already recruited");

        sellerRecruitments[_sellerId] = SellerRecruitment({
            ambassadorId: _ambassadorId,
            recruitedAt: block.timestamp,
            totalSalesVolume: 0,
            totalRewardsPaid: 0,
            completedOrderCount: 0,
            uniqueBuyerCount: 0,
            activated: false
        });

        ambassadors[_ambassadorId].recruitedSellers++;

        emit SellerRecruited(_sellerId, _ambassadorId);
    }

    // ============ Seller Activation (Circuit Breaker) ============

    function recordCompletedOrder(
        uint256 _sellerId,
        address _buyer
    ) external onlyMarketplace {
        SellerRecruitment storage recruitment = sellerRecruitments[_sellerId];

        if (recruitment.ambassadorId == 0) {
            return;
        }

        recruitment.completedOrderCount++;

        if (!sellerBuyers[_sellerId][_buyer]) {
            sellerBuyers[_sellerId][_buyer] = true;
            recruitment.uniqueBuyerCount++;
        }

        if (!recruitment.activated &&
            recruitment.completedOrderCount >= SELLER_MIN_ORDERS &&
            recruitment.uniqueBuyerCount >= SELLER_MIN_UNIQUE_BUYERS) {
            recruitment.activated = true;
            emit SellerActivated(_sellerId, recruitment.ambassadorId);
        }
    }

    // ============ Chain-Based Reward Distribution ============

    /**
     * @notice Queue rewards with chain-based distribution
     * @dev Walks up the ambassador chain, distributing 80/20 at each level
     */
    function queueReward(
        uint256 _orderId,
        uint256 _sellerId,
        uint256 _saleAmount
    ) external onlyMarketplace nonReentrant returns (uint256 pendingRewardId) {
        SellerRecruitment storage recruitment = sellerRecruitments[_sellerId];

        // Check if seller was recruited
        if (recruitment.ambassadorId == 0) {
            return 0;
        }

        // Check reward period
        if (block.timestamp > recruitment.recruitedAt + REWARD_DURATION) {
            return 0;
        }

        // Seller must be activated
        if (!recruitment.activated) {
            return 0;
        }

        // Calculate total reward pool (25% of sale)
        uint256 totalPool = (_saleAmount * TOTAL_REWARD_BPS) / 10000;

        // Check daily cap
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCap = treasuryInitialized ? (initialTreasuryBalance * DAILY_OUTFLOW_BPS) / 10000 : type(uint256).max;

        if (dailyOutflow[currentDay] + totalPool > dailyCap) {
            uint256 remaining = dailyCap > dailyOutflow[currentDay] ? dailyCap - dailyOutflow[currentDay] : 0;
            if (remaining == 0) {
                emit DailyCapReached(currentDay, dailyOutflow[currentDay]);
                return 0;
            }
            totalPool = remaining;
        }

        // Check contract balance
        uint256 contractBalance = rootsToken.balanceOf(address(this));
        if (totalPool > contractBalance) {
            totalPool = contractBalance;
        }

        if (totalPool == 0) {
            return 0;
        }

        // Create pending reward
        pendingRewardId = ++nextPendingRewardId;
        uint256 vestingEnds = block.timestamp + VESTING_PERIOD;

        pendingRewards[pendingRewardId] = PendingReward({
            orderId: _orderId,
            sellerId: _sellerId,
            queuedAt: block.timestamp,
            vestingEndsAt: vestingEnds,
            totalAmount: totalPool,
            claimed: false,
            clawedBack: false
        });

        // Walk the chain and create payouts
        uint256 remainingPool = totalPool;
        uint256 currentAmbassadorId = recruitment.ambassadorId;
        uint256 depth = 0;
        uint256 currentWeek = block.timestamp / 1 weeks;

        while (currentAmbassadorId != 0 && remainingPool > 0 && depth < MAX_CHAIN_DEPTH) {
            Ambassador storage amb = ambassadors[currentAmbassadorId];

            if (!amb.active || amb.suspended) {
                // Skip suspended/inactive, move to upline
                currentAmbassadorId = amb.uplineId;
                depth++;
                continue;
            }

            // Check ambassador cooldown
            if (block.timestamp < amb.createdAt + AMBASSADOR_COOLDOWN) {
                currentAmbassadorId = amb.uplineId;
                depth++;
                continue;
            }

            uint256 payout;
            if (amb.uplineId == 0) {
                // State Founder - keeps everything remaining
                payout = remainingPool;
            } else {
                // Regular ambassador - keeps 80%, passes 20% up
                payout = (remainingPool * RECRUITER_KEEP_BPS) / 10000;
            }

            // Check weekly cap for this ambassador
            uint256 weeklyUsed = ambassadorWeeklyRewards[currentAmbassadorId][currentWeek];
            if (weeklyUsed + payout > AMBASSADOR_WEEKLY_CAP) {
                uint256 weeklyRemaining = AMBASSADOR_WEEKLY_CAP > weeklyUsed ? AMBASSADOR_WEEKLY_CAP - weeklyUsed : 0;
                if (weeklyRemaining == 0) {
                    emit WeeklyCapReached(currentAmbassadorId, currentWeek, weeklyUsed);
                    // Skip this ambassador, but continue up chain with full remaining
                    currentAmbassadorId = amb.uplineId;
                    depth++;
                    continue;
                }
                payout = weeklyRemaining;
            }

            // Record the payout
            rewardPayouts[pendingRewardId].push(ChainPayout({
                pendingRewardId: pendingRewardId,
                ambassadorId: currentAmbassadorId,
                amount: payout,
                claimed: false
            }));

            // Update tracking
            amb.totalPending += payout;
            ambassadorWeeklyRewards[currentAmbassadorId][currentWeek] += payout;
            ambassadorPendingRewards[currentAmbassadorId].push(pendingRewardId);

            emit ChainPayoutQueued(pendingRewardId, currentAmbassadorId, payout, depth);

            // Update remaining and move up chain
            remainingPool -= payout;
            currentAmbassadorId = amb.uplineId;
            depth++;
        }

        // Update daily outflow with actual distributed amount
        uint256 distributed = totalPool - remainingPool;

        // If no rewards were actually distributed (e.g., all ambassadors in cooldown), clean up
        if (distributed == 0) {
            delete pendingRewards[pendingRewardId];
            nextPendingRewardId--;
            return 0;
        }

        dailyOutflow[currentDay] += distributed;
        recruitment.totalSalesVolume += _saleAmount;

        emit RewardQueued(pendingRewardId, _orderId, distributed, depth);

        return pendingRewardId;
    }

    // ============ Claim Rewards ============

    /**
     * @notice Claim all vested rewards for the caller
     */
    function claimVestedRewards() external nonReentrant {
        uint256 ambassadorId = ambassadorIdByWallet[_msgSender()];
        require(ambassadorId != 0, "Not an ambassador");
        require(!ambassadors[ambassadorId].suspended, "Ambassador suspended");

        Ambassador storage ambassador = ambassadors[ambassadorId];
        uint256[] storage rewardIds = ambassadorPendingRewards[ambassadorId];
        uint256 totalToClaim = 0;

        for (uint256 i = 0; i < rewardIds.length; i++) {
            uint256 rewardId = rewardIds[i];
            PendingReward storage reward = pendingRewards[rewardId];

            if (reward.clawedBack) {
                continue;
            }

            if (block.timestamp < reward.vestingEndsAt) {
                continue;
            }

            // Find this ambassador's payout in the chain
            ChainPayout[] storage payouts = rewardPayouts[rewardId];
            for (uint256 j = 0; j < payouts.length; j++) {
                if (payouts[j].ambassadorId == ambassadorId && !payouts[j].claimed) {
                    totalToClaim += payouts[j].amount;
                    payouts[j].claimed = true;

                    ambassador.totalPending -= payouts[j].amount;
                    ambassador.totalEarned += payouts[j].amount;

                    // Update seller recruitment stats
                    SellerRecruitment storage recruitment = sellerRecruitments[reward.sellerId];
                    recruitment.totalRewardsPaid += payouts[j].amount;

                    emit RewardClaimed(rewardId, ambassadorId, payouts[j].amount);
                }
            }
        }

        require(totalToClaim > 0, "No rewards to claim");
        rootsToken.safeTransfer(_msgSender(), totalToClaim);
    }

    // ============ Clawback ============

    /**
     * @notice Clawback pending reward for disputed order
     */
    function clawbackReward(uint256 _orderId, string calldata _reason) external onlyMarketplace {
        for (uint256 i = 1; i <= nextPendingRewardId; i++) {
            PendingReward storage reward = pendingRewards[i];
            if (reward.orderId == _orderId && !reward.claimed && !reward.clawedBack) {
                reward.clawedBack = true;

                // Reduce pending amounts for all in chain
                ChainPayout[] storage payouts = rewardPayouts[i];
                for (uint256 j = 0; j < payouts.length; j++) {
                    if (!payouts[j].claimed) {
                        Ambassador storage amb = ambassadors[payouts[j].ambassadorId];
                        amb.totalPending -= payouts[j].amount;
                    }
                }

                emit RewardClawedBack(i, _orderId, _reason);
                return;
            }
        }
    }

    // ============ Governance Functions ============

    function flagAmbassador(
        uint256 _targetAmbassadorId,
        string calldata _reason
    ) external onlyActiveAmbassador returns (uint256 flagId) {
        uint256 flaggedBy = ambassadorIdByWallet[_msgSender()];
        require(_targetAmbassadorId != flaggedBy, "Cannot flag yourself");
        require(ambassadors[_targetAmbassadorId].active, "Target not active");
        require(!ambassadors[_targetAmbassadorId].suspended, "Already suspended");

        flagId = ++nextFlagId;

        fraudFlags[flagId] = FraudFlag({
            targetAmbassadorId: _targetAmbassadorId,
            flaggedBy: flaggedBy,
            reason: _reason,
            createdAt: block.timestamp,
            votesFor: 1,
            votesAgainst: 0,
            resolved: false,
            suspended: false
        });

        hasVoted[flagId][flaggedBy] = true;

        emit FraudFlagRaised(flagId, _targetAmbassadorId, flaggedBy);
    }

    function voteOnFlag(uint256 _flagId, bool _voteToSuspend) external onlyActiveAmbassador {
        uint256 ambassadorId = ambassadorIdByWallet[_msgSender()];
        FraudFlag storage flag = fraudFlags[_flagId];

        require(!flag.resolved, "Flag already resolved");
        require(block.timestamp <= flag.createdAt + VOTE_DURATION, "Voting period ended");
        require(!hasVoted[_flagId][ambassadorId], "Already voted");
        require(flag.targetAmbassadorId != ambassadorId, "Cannot vote on own flag");

        hasVoted[_flagId][ambassadorId] = true;

        if (_voteToSuspend) {
            flag.votesFor++;
        } else {
            flag.votesAgainst++;
        }

        emit VoteCast(_flagId, ambassadorId, _voteToSuspend);
    }

    function resolveFlag(uint256 _flagId) external {
        FraudFlag storage flag = fraudFlags[_flagId];

        require(!flag.resolved, "Already resolved");
        require(block.timestamp > flag.createdAt + VOTE_DURATION, "Voting still active");

        flag.resolved = true;

        uint256 totalVotes = flag.votesFor + flag.votesAgainst;

        if (totalVotes >= MIN_VOTES_REQUIRED && flag.votesFor > flag.votesAgainst) {
            flag.suspended = true;
            ambassadors[flag.targetAmbassadorId].suspended = true;
            _clawbackAllPending(flag.targetAmbassadorId);
            emit AmbassadorSuspended(flag.targetAmbassadorId);
        }

        emit FraudFlagResolved(_flagId, flag.targetAmbassadorId, flag.suspended);
    }

    function _clawbackAllPending(uint256 _ambassadorId) internal {
        uint256[] storage rewardIds = ambassadorPendingRewards[_ambassadorId];

        for (uint256 i = 0; i < rewardIds.length; i++) {
            PendingReward storage reward = pendingRewards[rewardIds[i]];
            if (!reward.clawedBack) {
                ChainPayout[] storage payouts = rewardPayouts[rewardIds[i]];
                for (uint256 j = 0; j < payouts.length; j++) {
                    if (payouts[j].ambassadorId == _ambassadorId && !payouts[j].claimed) {
                        ambassadors[_ambassadorId].totalPending -= payouts[j].amount;
                        emit RewardClawedBack(rewardIds[i], reward.orderId, "Ambassador suspended");
                    }
                }
            }
        }
    }

    // ============ View Functions ============

    function getAmbassador(uint256 _ambassadorId) external view returns (Ambassador memory) {
        return ambassadors[_ambassadorId];
    }

    function getSellerRecruitment(uint256 _sellerId) external view returns (SellerRecruitment memory) {
        return sellerRecruitments[_sellerId];
    }

    function getPendingReward(uint256 _pendingRewardId) external view returns (PendingReward memory) {
        return pendingRewards[_pendingRewardId];
    }

    function getRewardPayouts(uint256 _pendingRewardId) external view returns (ChainPayout[] memory) {
        return rewardPayouts[_pendingRewardId];
    }

    function getAmbassadorChain(uint256 _ambassadorId) external view returns (uint256[] memory) {
        uint256[] memory chain = new uint256[](MAX_CHAIN_DEPTH);
        uint256 current = _ambassadorId;
        uint256 depth = 0;

        while (current != 0 && depth < MAX_CHAIN_DEPTH) {
            chain[depth] = current;
            current = ambassadors[current].uplineId;
            depth++;
        }

        // Resize array to actual length
        uint256[] memory result = new uint256[](depth);
        for (uint256 i = 0; i < depth; i++) {
            result[i] = chain[i];
        }
        return result;
    }

    function getClaimableRewards(uint256 _ambassadorId) external view returns (uint256) {
        uint256[] storage rewardIds = ambassadorPendingRewards[_ambassadorId];
        uint256 claimable = 0;

        for (uint256 i = 0; i < rewardIds.length; i++) {
            PendingReward storage reward = pendingRewards[rewardIds[i]];

            if (reward.clawedBack || block.timestamp < reward.vestingEndsAt) {
                continue;
            }

            ChainPayout[] storage payouts = rewardPayouts[rewardIds[i]];
            for (uint256 j = 0; j < payouts.length; j++) {
                if (payouts[j].ambassadorId == _ambassadorId && !payouts[j].claimed) {
                    claimable += payouts[j].amount;
                }
            }
        }

        return claimable;
    }

    function isSellerActivated(uint256 _sellerId) external view returns (bool) {
        return sellerRecruitments[_sellerId].activated;
    }

    function isAmbassadorActive(uint256 _ambassadorId) external view returns (bool) {
        Ambassador storage amb = ambassadors[_ambassadorId];
        if (!amb.active || amb.suspended) {
            return false;
        }
        return block.timestamp >= amb.createdAt + AMBASSADOR_COOLDOWN;
    }

    function getAmbassadorId(address _wallet) external view returns (uint256) {
        return ambassadorIdByWallet[_wallet];
    }

    function getRemainingDailyAllowance() external view returns (uint256) {
        if (!treasuryInitialized) {
            return type(uint256).max;
        }
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCap = (initialTreasuryBalance * DAILY_OUTFLOW_BPS) / 10000;
        uint256 used = dailyOutflow[currentDay];
        return dailyCap > used ? dailyCap - used : 0;
    }

    function getRemainingWeeklyAllowance(uint256 _ambassadorId) external view returns (uint256) {
        uint256 currentWeek = block.timestamp / 1 weeks;
        uint256 used = ambassadorWeeklyRewards[_ambassadorId][currentWeek];
        return AMBASSADOR_WEEKLY_CAP > used ? AMBASSADOR_WEEKLY_CAP - used : 0;
    }

    function treasuryBalance() external view returns (uint256) {
        return rootsToken.balanceOf(address(this));
    }

    function hasSufficientTreasury(uint256 _amount) external view returns (bool) {
        return rootsToken.balanceOf(address(this)) >= _amount;
    }
}
