// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AmbassadorRewards
 * @notice Manages ambassador rewards with vesting, fraud protection, and circuit breakers
 * @dev Ambassadors earn 25% of sales from sellers they recruit (for 1 year)
 *
 *      FRAUD PROTECTION:
 *      - Rewards vest over 7 days (can be clawed back if disputed)
 *      - Ambassador governance can vote to suspend bad actors
 *
 *      CIRCUIT BREAKERS (Tier 1):
 *      - Daily treasury outflow cap: 0.5% of initial treasury per day
 *      - Ambassador weekly cap: 10,000 ROOTS per ambassador per week
 *      - New ambassador cooldown: 24 hours before rewards activate
 *      - Seller activation: 2 orders from 2 unique buyers required
 */
contract AmbassadorRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable rootsToken;
    address public marketplace;

    // Core reward parameters
    uint256 public constant AMBASSADOR_REWARD_BPS = 2500;     // 25% of sale
    uint256 public constant SENIOR_CUT_BPS = 500;             // 5% to senior ambassador
    uint256 public constant REWARD_DURATION = 365 days;       // 1 year per seller
    uint256 public constant VESTING_PERIOD = 7 days;          // Rewards vest over 7 days

    // Governance parameters
    uint256 public constant VOTE_DURATION = 3 days;           // Voting period for suspension
    uint256 public constant MIN_VOTES_REQUIRED = 3;           // Minimum votes needed

    // Circuit breaker parameters
    uint256 public constant DAILY_OUTFLOW_BPS = 50;           // 0.5% of initial treasury per day
    uint256 public constant AMBASSADOR_WEEKLY_CAP = 10_000 * 10**18;  // 10,000 ROOTS per week
    uint256 public constant AMBASSADOR_COOLDOWN = 24 hours;   // New ambassador wait period
    uint256 public constant SELLER_MIN_ORDERS = 2;            // Min orders before rewards
    uint256 public constant SELLER_MIN_UNIQUE_BUYERS = 2;     // Min unique buyers before rewards

    uint256 public nextAmbassadorId;
    uint256 public nextPendingRewardId;
    uint256 public nextFlagId;

    // Circuit breaker state
    uint256 public initialTreasuryBalance;                    // Set on first deposit
    bool public treasuryInitialized;

    // ============ Structs ============

    struct Ambassador {
        address wallet;
        uint256 seniorAmbassadorId;    // 0 if top-level
        uint256 totalEarned;
        uint256 totalPending;          // Pending vesting rewards
        uint256 recruitedSellers;
        uint256 recruitedAmbassadors;
        uint256 createdAt;
        bool active;
        bool suspended;                // Suspended by governance vote
    }

    struct SellerRecruitment {
        uint256 ambassadorId;
        uint256 recruitedAt;
        uint256 totalSalesVolume;
        uint256 totalRewardsPaid;
        uint256 completedOrderCount;   // Number of completed orders
        uint256 uniqueBuyerCount;      // Number of unique buyers
        bool activated;                // Met activation threshold
    }

    struct PendingReward {
        uint256 orderId;
        uint256 sellerId;
        uint256 ambassadorId;
        uint256 seniorAmbassadorId;
        uint256 ambassadorAmount;
        uint256 seniorAmount;
        uint256 queuedAt;
        uint256 vestingEndsAt;
        bool claimed;
        bool clawedBack;
    }

    struct FraudFlag {
        uint256 targetAmbassadorId;
        uint256 flaggedBy;             // Ambassador ID who raised the flag
        string reason;
        uint256 createdAt;
        uint256 votesFor;              // Votes to suspend
        uint256 votesAgainst;          // Votes against suspension
        bool resolved;
        bool suspended;                // Result: was ambassador suspended?
    }

    // ============ Mappings ============

    mapping(uint256 => Ambassador) public ambassadors;
    mapping(address => uint256) public ambassadorIdByWallet;
    mapping(uint256 => SellerRecruitment) public sellerRecruitments;
    mapping(uint256 => PendingReward) public pendingRewards;
    mapping(uint256 => FraudFlag) public fraudFlags;
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted; // flagId => ambassadorId => voted
    mapping(uint256 => uint256[]) public ambassadorPendingRewards; // ambassadorId => pendingRewardIds

    // Circuit breaker tracking
    mapping(uint256 => uint256) public dailyOutflow;          // day => amount paid out
    mapping(uint256 => mapping(uint256 => uint256)) public ambassadorWeeklyRewards; // ambassadorId => week => amount
    mapping(uint256 => mapping(address => bool)) public sellerBuyers; // sellerId => buyer => hasPurchased

    // ============ Events ============

    event AmbassadorRegistered(uint256 indexed ambassadorId, address indexed wallet, uint256 seniorId);
    event SellerRecruited(uint256 indexed sellerId, uint256 indexed ambassadorId);
    event SellerActivated(uint256 indexed sellerId, uint256 indexed ambassadorId);
    event RewardQueued(
        uint256 indexed pendingRewardId,
        uint256 indexed orderId,
        uint256 indexed ambassadorId,
        uint256 amount,
        uint256 vestingEndsAt
    );
    event RewardClaimed(uint256 indexed pendingRewardId, uint256 indexed ambassadorId, uint256 amount);
    event RewardClawedBack(uint256 indexed pendingRewardId, uint256 indexed orderId, string reason);
    event FraudFlagRaised(uint256 indexed flagId, uint256 indexed targetAmbassadorId, uint256 indexed flaggedBy);
    event VoteCast(uint256 indexed flagId, uint256 indexed ambassadorId, bool voteToSuspend);
    event FraudFlagResolved(uint256 indexed flagId, uint256 indexed targetAmbassadorId, bool suspended);
    event AmbassadorSuspended(uint256 indexed ambassadorId);
    event AmbassadorReinstated(uint256 indexed ambassadorId);
    event DailyCapReached(uint256 indexed day, uint256 amount);
    event WeeklyCapReached(uint256 indexed ambassadorId, uint256 indexed week, uint256 amount);
    event TreasuryInitialized(uint256 amount);

    // ============ Modifiers ============

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Only marketplace");
        _;
    }

    modifier onlyActiveAmbassador() {
        uint256 ambassadorId = ambassadorIdByWallet[msg.sender];
        require(ambassadorId != 0, "Not an ambassador");
        require(ambassadors[ambassadorId].active, "Ambassador not active");
        require(!ambassadors[ambassadorId].suspended, "Ambassador suspended");
        _;
    }

    // ============ Constructor ============

    constructor(address _rootsToken) {
        require(_rootsToken != address(0), "Invalid token address");
        rootsToken = IERC20(_rootsToken);
    }

    // ============ Admin Functions ============

    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "Marketplace already set");
        require(_marketplace != address(0), "Invalid marketplace address");
        marketplace = _marketplace;
    }

    /**
     * @notice Initialize treasury balance for daily cap calculation
     * @dev Called once after initial funding
     */
    function initializeTreasury() external {
        require(!treasuryInitialized, "Already initialized");
        uint256 balance = rootsToken.balanceOf(address(this));
        require(balance > 0, "No treasury balance");

        initialTreasuryBalance = balance;
        treasuryInitialized = true;

        emit TreasuryInitialized(balance);
    }

    // ============ Ambassador Functions ============

    function registerAmbassador(uint256 _seniorAmbassadorId) external returns (uint256 ambassadorId) {
        require(ambassadorIdByWallet[msg.sender] == 0, "Already an ambassador");

        if (_seniorAmbassadorId != 0) {
            require(ambassadors[_seniorAmbassadorId].active, "Invalid senior ambassador");
            require(!ambassadors[_seniorAmbassadorId].suspended, "Senior ambassador suspended");
            ambassadors[_seniorAmbassadorId].recruitedAmbassadors++;
        }

        ambassadorId = ++nextAmbassadorId;

        ambassadors[ambassadorId] = Ambassador({
            wallet: msg.sender,
            seniorAmbassadorId: _seniorAmbassadorId,
            totalEarned: 0,
            totalPending: 0,
            recruitedSellers: 0,
            recruitedAmbassadors: 0,
            createdAt: block.timestamp,
            active: true,
            suspended: false
        });

        ambassadorIdByWallet[msg.sender] = ambassadorId;

        emit AmbassadorRegistered(ambassadorId, msg.sender, _seniorAmbassadorId);
    }

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

    /**
     * @notice Record a completed order for seller activation tracking
     * @dev Called by marketplace when order is completed
     */
    function recordCompletedOrder(
        uint256 _sellerId,
        address _buyer
    ) external onlyMarketplace {
        SellerRecruitment storage recruitment = sellerRecruitments[_sellerId];

        if (recruitment.ambassadorId == 0) {
            return; // Seller not recruited
        }

        recruitment.completedOrderCount++;

        // Track unique buyers
        if (!sellerBuyers[_sellerId][_buyer]) {
            sellerBuyers[_sellerId][_buyer] = true;
            recruitment.uniqueBuyerCount++;
        }

        // Check activation threshold
        if (!recruitment.activated &&
            recruitment.completedOrderCount >= SELLER_MIN_ORDERS &&
            recruitment.uniqueBuyerCount >= SELLER_MIN_UNIQUE_BUYERS) {
            recruitment.activated = true;
            emit SellerActivated(_sellerId, recruitment.ambassadorId);
        }
    }

    // ============ Reward Vesting Functions ============

    /**
     * @notice Queue rewards for vesting (called when order is completed)
     * @dev Includes circuit breaker checks:
     *      - Ambassador must be past 24h cooldown
     *      - Seller must be activated (2 orders, 2 unique buyers)
     *      - Daily treasury outflow must not exceed 0.5%
     *      - Ambassador weekly rewards must not exceed 10,000 ROOTS
     */
    function queueReward(
        uint256 _orderId,
        uint256 _sellerId,
        uint256 _saleAmount
    ) external onlyMarketplace nonReentrant returns (uint256 pendingRewardId) {
        SellerRecruitment storage recruitment = sellerRecruitments[_sellerId];

        // Check if seller was recruited and still within reward period
        if (recruitment.ambassadorId == 0) {
            return 0; // Seller not recruited by ambassador
        }

        if (block.timestamp > recruitment.recruitedAt + REWARD_DURATION) {
            return 0; // Reward period expired
        }

        // CIRCUIT BREAKER: Seller must be activated
        if (!recruitment.activated) {
            return 0; // Seller hasn't met activation threshold
        }

        Ambassador storage ambassador = ambassadors[recruitment.ambassadorId];
        if (!ambassador.active || ambassador.suspended) {
            return 0;
        }

        // CIRCUIT BREAKER: Ambassador cooldown (24 hours)
        if (block.timestamp < ambassador.createdAt + AMBASSADOR_COOLDOWN) {
            return 0; // Ambassador still in cooldown period
        }

        uint256 totalReward = (_saleAmount * AMBASSADOR_REWARD_BPS) / 10000;

        // CIRCUIT BREAKER: Daily treasury outflow cap
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCap = (initialTreasuryBalance * DAILY_OUTFLOW_BPS) / 10000;

        if (treasuryInitialized && dailyOutflow[currentDay] + totalReward > dailyCap) {
            // Cap reached - reduce reward to remaining allowance
            uint256 remaining = dailyCap > dailyOutflow[currentDay] ?
                dailyCap - dailyOutflow[currentDay] : 0;
            if (remaining == 0) {
                emit DailyCapReached(currentDay, dailyOutflow[currentDay]);
                return 0;
            }
            totalReward = remaining;
        }

        // CIRCUIT BREAKER: Ambassador weekly cap
        uint256 currentWeek = block.timestamp / 1 weeks;
        uint256 ambassadorWeeklyTotal = ambassadorWeeklyRewards[recruitment.ambassadorId][currentWeek];

        if (ambassadorWeeklyTotal + totalReward > AMBASSADOR_WEEKLY_CAP) {
            uint256 remaining = AMBASSADOR_WEEKLY_CAP > ambassadorWeeklyTotal ?
                AMBASSADOR_WEEKLY_CAP - ambassadorWeeklyTotal : 0;
            if (remaining == 0) {
                emit WeeklyCapReached(recruitment.ambassadorId, currentWeek, ambassadorWeeklyTotal);
                return 0;
            }
            totalReward = remaining;
        }

        uint256 contractBalance = rootsToken.balanceOf(address(this));
        if (totalReward > contractBalance) {
            totalReward = contractBalance;
        }

        if (totalReward == 0) {
            return 0;
        }

        // Update circuit breaker tracking
        dailyOutflow[currentDay] += totalReward;
        ambassadorWeeklyRewards[recruitment.ambassadorId][currentWeek] += totalReward;

        uint256 seniorReward = 0;
        uint256 ambassadorReward = totalReward;
        uint256 seniorId = 0;

        // Calculate senior's cut if applicable
        if (ambassador.seniorAmbassadorId != 0) {
            Ambassador storage senior = ambassadors[ambassador.seniorAmbassadorId];
            if (senior.active && !senior.suspended) {
                // Senior must also be past cooldown
                if (block.timestamp >= senior.createdAt + AMBASSADOR_COOLDOWN) {
                    seniorReward = (totalReward * SENIOR_CUT_BPS) / AMBASSADOR_REWARD_BPS;
                    ambassadorReward = totalReward - seniorReward;
                    seniorId = ambassador.seniorAmbassadorId;
                    senior.totalPending += seniorReward;

                    // Track senior's weekly rewards too
                    ambassadorWeeklyRewards[seniorId][currentWeek] += seniorReward;
                }
            }
        }

        ambassador.totalPending += ambassadorReward;

        pendingRewardId = ++nextPendingRewardId;
        uint256 vestingEnds = block.timestamp + VESTING_PERIOD;

        pendingRewards[pendingRewardId] = PendingReward({
            orderId: _orderId,
            sellerId: _sellerId,
            ambassadorId: recruitment.ambassadorId,
            seniorAmbassadorId: seniorId,
            ambassadorAmount: ambassadorReward,
            seniorAmount: seniorReward,
            queuedAt: block.timestamp,
            vestingEndsAt: vestingEnds,
            claimed: false,
            clawedBack: false
        });

        ambassadorPendingRewards[recruitment.ambassadorId].push(pendingRewardId);
        if (seniorId != 0) {
            ambassadorPendingRewards[seniorId].push(pendingRewardId);
        }

        recruitment.totalSalesVolume += _saleAmount;

        emit RewardQueued(pendingRewardId, _orderId, recruitment.ambassadorId, totalReward, vestingEnds);
    }

    /**
     * @notice Claim all vested rewards
     */
    function claimVestedRewards() external nonReentrant {
        uint256 ambassadorId = ambassadorIdByWallet[msg.sender];
        require(ambassadorId != 0, "Not an ambassador");
        require(!ambassadors[ambassadorId].suspended, "Ambassador suspended");

        Ambassador storage ambassador = ambassadors[ambassadorId];
        uint256[] storage rewardIds = ambassadorPendingRewards[ambassadorId];
        uint256 totalToClaim = 0;

        for (uint256 i = 0; i < rewardIds.length; i++) {
            PendingReward storage reward = pendingRewards[rewardIds[i]];

            if (reward.claimed || reward.clawedBack) {
                continue;
            }

            if (block.timestamp < reward.vestingEndsAt) {
                continue;
            }

            // Determine amount for this ambassador (could be primary or senior)
            uint256 amount = 0;
            if (reward.ambassadorId == ambassadorId) {
                amount = reward.ambassadorAmount;
            } else if (reward.seniorAmbassadorId == ambassadorId) {
                amount = reward.seniorAmount;
            }

            if (amount > 0) {
                totalToClaim += amount;

                // Mark as claimed only if this is the primary ambassador
                // or if senior has already claimed their portion
                if (reward.ambassadorId == ambassadorId) {
                    if (reward.seniorAmount == 0 || reward.seniorAmbassadorId == 0) {
                        reward.claimed = true;
                    }
                    ambassador.totalPending -= amount;
                    ambassador.totalEarned += amount;

                    // Update recruitment stats
                    SellerRecruitment storage recruitment = sellerRecruitments[reward.sellerId];
                    recruitment.totalRewardsPaid += reward.ambassadorAmount + reward.seniorAmount;
                } else if (reward.seniorAmbassadorId == ambassadorId) {
                    ambassador.totalPending -= amount;
                    ambassador.totalEarned += amount;
                }

                emit RewardClaimed(rewardIds[i], ambassadorId, amount);
            }
        }

        require(totalToClaim > 0, "No rewards to claim");
        rootsToken.safeTransfer(msg.sender, totalToClaim);
    }

    /**
     * @notice Clawback pending reward for disputed order
     * @dev Called by marketplace when order is disputed
     */
    function clawbackReward(uint256 _orderId, string calldata _reason) external onlyMarketplace {
        // Find the pending reward for this order
        for (uint256 i = 1; i <= nextPendingRewardId; i++) {
            PendingReward storage reward = pendingRewards[i];
            if (reward.orderId == _orderId && !reward.claimed && !reward.clawedBack) {
                reward.clawedBack = true;

                // Reduce pending amounts
                Ambassador storage ambassador = ambassadors[reward.ambassadorId];
                ambassador.totalPending -= reward.ambassadorAmount;

                if (reward.seniorAmbassadorId != 0) {
                    Ambassador storage senior = ambassadors[reward.seniorAmbassadorId];
                    senior.totalPending -= reward.seniorAmount;
                }

                emit RewardClawedBack(i, _orderId, _reason);
                return;
            }
        }
    }

    // ============ Governance Functions ============

    /**
     * @notice Flag an ambassador for potential fraud
     * @param _targetAmbassadorId Ambassador to flag
     * @param _reason Description of suspected fraud
     */
    function flagAmbassador(
        uint256 _targetAmbassadorId,
        string calldata _reason
    ) external onlyActiveAmbassador returns (uint256 flagId) {
        uint256 flaggedBy = ambassadorIdByWallet[msg.sender];
        require(_targetAmbassadorId != flaggedBy, "Cannot flag yourself");
        require(ambassadors[_targetAmbassadorId].active, "Target not active");
        require(!ambassadors[_targetAmbassadorId].suspended, "Already suspended");

        flagId = ++nextFlagId;

        fraudFlags[flagId] = FraudFlag({
            targetAmbassadorId: _targetAmbassadorId,
            flaggedBy: flaggedBy,
            reason: _reason,
            createdAt: block.timestamp,
            votesFor: 1, // Flagger automatically votes for suspension
            votesAgainst: 0,
            resolved: false,
            suspended: false
        });

        hasVoted[flagId][flaggedBy] = true;

        emit FraudFlagRaised(flagId, _targetAmbassadorId, flaggedBy);
    }

    /**
     * @notice Vote on a fraud flag
     * @param _flagId Flag to vote on
     * @param _voteToSuspend True to vote for suspension, false against
     */
    function voteOnFlag(uint256 _flagId, bool _voteToSuspend) external onlyActiveAmbassador {
        uint256 ambassadorId = ambassadorIdByWallet[msg.sender];
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

    /**
     * @notice Resolve a fraud flag after voting period ends
     */
    function resolveFlag(uint256 _flagId) external {
        FraudFlag storage flag = fraudFlags[_flagId];

        require(!flag.resolved, "Already resolved");
        require(block.timestamp > flag.createdAt + VOTE_DURATION, "Voting still active");

        flag.resolved = true;

        uint256 totalVotes = flag.votesFor + flag.votesAgainst;

        // Need minimum votes and majority to suspend
        if (totalVotes >= MIN_VOTES_REQUIRED && flag.votesFor > flag.votesAgainst) {
            flag.suspended = true;
            ambassadors[flag.targetAmbassadorId].suspended = true;

            // Clawback all pending rewards for suspended ambassador
            _clawbackAllPending(flag.targetAmbassadorId);

            emit AmbassadorSuspended(flag.targetAmbassadorId);
        }

        emit FraudFlagResolved(_flagId, flag.targetAmbassadorId, flag.suspended);
    }

    /**
     * @notice Clawback all pending rewards for a suspended ambassador
     */
    function _clawbackAllPending(uint256 _ambassadorId) internal {
        uint256[] storage rewardIds = ambassadorPendingRewards[_ambassadorId];

        for (uint256 i = 0; i < rewardIds.length; i++) {
            PendingReward storage reward = pendingRewards[rewardIds[i]];

            if (!reward.claimed && !reward.clawedBack) {
                if (reward.ambassadorId == _ambassadorId) {
                    reward.clawedBack = true;
                    ambassadors[_ambassadorId].totalPending -= reward.ambassadorAmount;
                    emit RewardClawedBack(rewardIds[i], reward.orderId, "Ambassador suspended");
                }
            }
        }
    }

    // ============ View Functions ============

    function hasSufficientTreasury(uint256 _rewardAmount) external view returns (bool) {
        return rootsToken.balanceOf(address(this)) >= _rewardAmount;
    }

    function treasuryBalance() external view returns (uint256) {
        return rootsToken.balanceOf(address(this));
    }

    function getAmbassador(uint256 _ambassadorId) external view returns (Ambassador memory) {
        return ambassadors[_ambassadorId];
    }

    function getSellerRecruitment(uint256 _sellerId) external view returns (SellerRecruitment memory) {
        return sellerRecruitments[_sellerId];
    }

    function getPendingReward(uint256 _pendingRewardId) external view returns (PendingReward memory) {
        return pendingRewards[_pendingRewardId];
    }

    function getFraudFlag(uint256 _flagId) external view returns (FraudFlag memory) {
        return fraudFlags[_flagId];
    }

    function isRewardPeriodActive(uint256 _sellerId) external view returns (bool) {
        SellerRecruitment storage recruitment = sellerRecruitments[_sellerId];
        if (recruitment.ambassadorId == 0) {
            return false;
        }
        return block.timestamp <= recruitment.recruitedAt + REWARD_DURATION;
    }

    function getAmbassadorId(address _wallet) external view returns (uint256) {
        return ambassadorIdByWallet[_wallet];
    }

    function getClaimableRewards(uint256 _ambassadorId) external view returns (uint256) {
        uint256[] storage rewardIds = ambassadorPendingRewards[_ambassadorId];
        uint256 claimable = 0;

        for (uint256 i = 0; i < rewardIds.length; i++) {
            PendingReward storage reward = pendingRewards[rewardIds[i]];

            if (reward.claimed || reward.clawedBack) {
                continue;
            }

            if (block.timestamp < reward.vestingEndsAt) {
                continue;
            }

            if (reward.ambassadorId == _ambassadorId) {
                claimable += reward.ambassadorAmount;
            } else if (reward.seniorAmbassadorId == _ambassadorId) {
                claimable += reward.seniorAmount;
            }
        }

        return claimable;
    }

    function getPendingRewardIds(uint256 _ambassadorId) external view returns (uint256[] memory) {
        return ambassadorPendingRewards[_ambassadorId];
    }

    /**
     * @notice Get remaining daily outflow allowance
     */
    function getRemainingDailyAllowance() external view returns (uint256) {
        if (!treasuryInitialized) {
            return 0;
        }
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyCap = (initialTreasuryBalance * DAILY_OUTFLOW_BPS) / 10000;
        uint256 used = dailyOutflow[currentDay];
        return dailyCap > used ? dailyCap - used : 0;
    }

    /**
     * @notice Get remaining weekly allowance for an ambassador
     */
    function getRemainingWeeklyAllowance(uint256 _ambassadorId) external view returns (uint256) {
        uint256 currentWeek = block.timestamp / 1 weeks;
        uint256 used = ambassadorWeeklyRewards[_ambassadorId][currentWeek];
        return AMBASSADOR_WEEKLY_CAP > used ? AMBASSADOR_WEEKLY_CAP - used : 0;
    }

    /**
     * @notice Check if ambassador is past cooldown period
     */
    function isAmbassadorActive(uint256 _ambassadorId) external view returns (bool) {
        Ambassador storage amb = ambassadors[_ambassadorId];
        if (!amb.active || amb.suspended) {
            return false;
        }
        return block.timestamp >= amb.createdAt + AMBASSADOR_COOLDOWN;
    }

    /**
     * @notice Check if seller is activated for rewards
     */
    function isSellerActivated(uint256 _sellerId) external view returns (bool) {
        return sellerRecruitments[_sellerId].activated;
    }

    // Keep old interface for backward compatibility (now deprecated)
    function distributeRewards(uint256, uint256) external view onlyMarketplace {
        revert("Use queueReward instead");
    }
}
