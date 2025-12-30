// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/AmbassadorRewards.sol";

contract AmbassadorRewardsTest is Test {
    RootsToken public token;
    AmbassadorRewards public rewards;

    address public founderVesting = address(0x1);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);
    address public marketplace = address(0x6);

    address public stateFounder = address(0x50);   // Claire (State Founder)
    address public cityAmbassador = address(0x100);  // City level
    address public neighborhoodAmbassador = address(0x101);  // Neighborhood level
    address public blockAmbassador = address(0x102);  // Block level
    address public buyer1 = address(0x200);
    address public buyer2 = address(0x201);

    uint256 public constant AMBASSADOR_ALLOCATION = 25_000_000 * 10**18;
    uint256 public constant REWARD_DURATION = 365 days;
    uint256 public constant VESTING_PERIOD = 7 days;
    uint256 public constant AMBASSADOR_COOLDOWN = 24 hours;

    function setUp() public {
        // Deploy rewards contract first
        rewards = new AmbassadorRewards(address(1)); // temp token

        // Deploy token with rewards address
        token = new RootsToken(
            founderVesting,
            address(rewards),
            liquidityPool,
            treasury,
            airdrop
        );

        // Redeploy rewards with correct token
        rewards = new AmbassadorRewards(address(token));

        // Fund rewards contract
        vm.prank(treasury);
        token.transfer(address(rewards), AMBASSADOR_ALLOCATION);

        // Initialize treasury for circuit breakers
        rewards.initializeTreasury();

        // Set marketplace
        rewards.setMarketplace(marketplace);
    }

    // ============ Deployment Tests ============

    function test_TokenAddress() public view {
        assertEq(address(rewards.rootsToken()), address(token));
    }

    function test_MarketplaceAddress() public view {
        assertEq(rewards.marketplace(), marketplace);
    }

    function test_RewardDuration() public view {
        assertEq(rewards.REWARD_DURATION(), 365 days);
    }

    function test_TotalRewardBPS() public view {
        assertEq(rewards.TOTAL_REWARD_BPS(), 2500); // 25%
    }

    function test_UplineShareBPS() public view {
        assertEq(rewards.UPLINE_SHARE_BPS(), 2000); // 20%
    }

    function test_RecruiterKeepBPS() public view {
        assertEq(rewards.RECRUITER_KEEP_BPS(), 8000); // 80%
    }

    function test_VestingPeriod() public view {
        assertEq(rewards.VESTING_PERIOD(), 7 days);
    }

    function test_AmbassadorCooldown() public view {
        assertEq(rewards.AMBASSADOR_COOLDOWN(), 24 hours);
    }

    function test_TreasuryInitialized() public view {
        assertTrue(rewards.treasuryInitialized());
        assertEq(rewards.initialTreasuryBalance(), AMBASSADOR_ALLOCATION);
    }

    // ============ State Founder Registration Tests ============

    function test_RegisterStateFounder() public {
        bytes8 georgiaGeohash = bytes8("djq"); // Georgia prefix

        uint256 id = rewards.registerStateFounder(stateFounder, georgiaGeohash);

        assertEq(id, 1);
        assertEq(rewards.getAmbassadorId(stateFounder), 1);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertEq(amb.wallet, stateFounder);
        assertEq(amb.uplineId, 0); // No upline = State Founder
        assertEq(amb.totalEarned, 0);
        assertEq(amb.totalPending, 0);
        assertEq(amb.recruitedSellers, 0);
        assertEq(amb.recruitedAmbassadors, 0);
        assertTrue(amb.active);
        assertFalse(amb.suspended);
        assertEq(amb.regionGeohash, georgiaGeohash);
    }

    function test_RevertStateFounder_NotAdmin() public {
        bytes8 georgiaGeohash = bytes8("djq");

        vm.prank(stateFounder);
        vm.expectRevert("Only admin");
        rewards.registerStateFounder(stateFounder, georgiaGeohash);
    }

    function test_RevertStateFounder_AlreadyRegistered() public {
        bytes8 georgiaGeohash = bytes8("djq");
        rewards.registerStateFounder(stateFounder, georgiaGeohash);

        vm.expectRevert("Already an ambassador");
        rewards.registerStateFounder(stateFounder, bytes8("drt")); // Alabama
    }

    // ============ Ambassador Registration Tests ============

    function test_RegisterAmbassador() public {
        // First register state founder
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        // Register city ambassador under state founder
        vm.prank(cityAmbassador);
        uint256 id = rewards.registerAmbassador(1); // upline is state founder

        assertEq(id, 2);
        assertEq(rewards.getAmbassadorId(cityAmbassador), 2);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(2);
        assertEq(amb.wallet, cityAmbassador);
        assertEq(amb.uplineId, 1);
        assertEq(amb.regionGeohash, bytes8(0)); // Only State Founders have regions
        assertTrue(amb.active);

        // Check upline's count updated
        AmbassadorRewards.Ambassador memory upline = rewards.getAmbassador(1);
        assertEq(upline.recruitedAmbassadors, 1);
    }

    function test_RegisterMultiLevelChain() public {
        // State Founder -> City -> Neighborhood -> Block
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(cityAmbassador);
        rewards.registerAmbassador(1);

        vm.prank(neighborhoodAmbassador);
        rewards.registerAmbassador(2);

        vm.prank(blockAmbassador);
        rewards.registerAmbassador(3);

        // Verify chain
        uint256[] memory chain = rewards.getAmbassadorChain(4);
        assertEq(chain.length, 4);
        assertEq(chain[0], 4); // Block
        assertEq(chain[1], 3); // Neighborhood
        assertEq(chain[2], 2); // City
        assertEq(chain[3], 1); // State Founder
    }

    function test_RevertRegister_AlreadyAmbassador() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.startPrank(cityAmbassador);
        rewards.registerAmbassador(1);

        vm.expectRevert("Already an ambassador");
        rewards.registerAmbassador(1);
        vm.stopPrank();
    }

    function test_RevertRegister_NoUpline() public {
        vm.prank(cityAmbassador);
        vm.expectRevert("Must have an upline (use registerStateFounder for founders)");
        rewards.registerAmbassador(0);
    }

    function test_RevertRegister_InvalidUpline() public {
        vm.prank(cityAmbassador);
        vm.expectRevert("Upline not active");
        rewards.registerAmbassador(999);
    }

    // ============ Seller Recruitment Tests ============

    function test_RecordSellerRecruitment() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1); // sellerId 1, ambassadorId 1

        AmbassadorRewards.SellerRecruitment memory recruitment =
            rewards.getSellerRecruitment(1);

        assertEq(recruitment.ambassadorId, 1);
        assertGt(recruitment.recruitedAt, 0);
        assertEq(recruitment.totalSalesVolume, 0);
        assertEq(recruitment.totalRewardsPaid, 0);
        assertEq(recruitment.completedOrderCount, 0);
        assertEq(recruitment.uniqueBuyerCount, 0);
        assertFalse(recruitment.activated);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertEq(amb.recruitedSellers, 1);
    }

    function test_RevertRecruitment_NotMarketplace() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(stateFounder);
        vm.expectRevert("Only marketplace");
        rewards.recordSellerRecruitment(1, 1);
    }

    // ============ Seller Activation Tests (Circuit Breaker) ============

    function test_SellerActivation() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        // First order from buyer1
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);

        AmbassadorRewards.SellerRecruitment memory recruitment = rewards.getSellerRecruitment(1);
        assertEq(recruitment.completedOrderCount, 1);
        assertEq(recruitment.uniqueBuyerCount, 1);
        assertFalse(recruitment.activated);

        // Second order from same buyer - doesn't increase unique count
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);

        recruitment = rewards.getSellerRecruitment(1);
        assertEq(recruitment.completedOrderCount, 2);
        assertEq(recruitment.uniqueBuyerCount, 1);
        assertFalse(recruitment.activated);

        // Third order from different buyer - activates!
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        recruitment = rewards.getSellerRecruitment(1);
        assertEq(recruitment.completedOrderCount, 3);
        assertEq(recruitment.uniqueBuyerCount, 2);
        assertTrue(recruitment.activated);
    }

    // ============ Chain-Based Reward Distribution Tests ============

    function _setupActivatedSellerWithChain() internal returns (uint256 sellerId) {
        sellerId = 1;

        // Setup 4-level chain: State -> City -> Neighborhood -> Block
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(cityAmbassador);
        rewards.registerAmbassador(1);

        vm.prank(neighborhoodAmbassador);
        rewards.registerAmbassador(2);

        vm.prank(blockAmbassador);
        rewards.registerAmbassador(3);

        // Wait for all cooldowns
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Block ambassador recruits seller
        vm.prank(marketplace);
        rewards.recordSellerRecruitment(sellerId, 4); // ambassadorId 4 = block

        // Activate seller (2 orders from 2 unique buyers)
        vm.prank(marketplace);
        rewards.recordCompletedOrder(sellerId, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(sellerId, buyer2);
    }

    function test_ChainBasedRewardDistribution() public {
        uint256 sellerId = _setupActivatedSellerWithChain();
        uint256 saleAmount = 1000 * 10**18;
        uint256 totalPool = (saleAmount * 2500) / 10000; // 25% = 250 ROOTS

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, saleAmount);

        assertGt(pendingRewardId, 0);

        // Get payouts for this reward
        AmbassadorRewards.ChainPayout[] memory payouts = rewards.getRewardPayouts(pendingRewardId);
        assertEq(payouts.length, 4); // All 4 levels get paid

        // Block ambassador (recruiter) gets 80% of pool
        uint256 blockPayout = (totalPool * 8000) / 10000; // 200 ROOTS
        assertEq(payouts[0].ambassadorId, 4);
        assertEq(payouts[0].amount, blockPayout);

        // Neighborhood gets 80% of remaining (20% of pool)
        uint256 remaining1 = totalPool - blockPayout; // 50
        uint256 neighborhoodPayout = (remaining1 * 8000) / 10000; // 40
        assertEq(payouts[1].ambassadorId, 3);
        assertEq(payouts[1].amount, neighborhoodPayout);

        // City gets 80% of remaining
        uint256 remaining2 = remaining1 - neighborhoodPayout; // 10
        uint256 cityPayout = (remaining2 * 8000) / 10000; // 8
        assertEq(payouts[2].ambassadorId, 2);
        assertEq(payouts[2].amount, cityPayout);

        // State Founder gets ALL remaining (no upline)
        uint256 stateFounderPayout = remaining2 - cityPayout; // 2
        assertEq(payouts[3].ambassadorId, 1);
        assertEq(payouts[3].amount, stateFounderPayout);

        // Verify total distributed equals pool
        uint256 totalDistributed = blockPayout + neighborhoodPayout + cityPayout + stateFounderPayout;
        assertEq(totalDistributed, totalPool);
    }

    function test_StateFounderDirectRecruitment() public {
        // State founder recruits seller directly - gets 100%
        rewards.registerStateFounder(stateFounder, bytes8("djq"));
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        uint256 saleAmount = 1000 * 10**18;
        uint256 expectedReward = (saleAmount * 2500) / 10000; // 25%

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, 1, saleAmount);

        AmbassadorRewards.ChainPayout[] memory payouts = rewards.getRewardPayouts(pendingRewardId);
        assertEq(payouts.length, 1); // Only state founder
        assertEq(payouts[0].ambassadorId, 1);
        assertEq(payouts[0].amount, expectedReward); // Gets full 25%
    }

    function test_CityAmbassadorRecruitment() public {
        // City ambassador recruits seller - city gets 80%, state gets 20%
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(cityAmbassador);
        rewards.registerAmbassador(1);

        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 2); // City ambassador

        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        uint256 saleAmount = 1000 * 10**18;
        uint256 totalPool = (saleAmount * 2500) / 10000; // 250

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, 1, saleAmount);

        AmbassadorRewards.ChainPayout[] memory payouts = rewards.getRewardPayouts(pendingRewardId);
        assertEq(payouts.length, 2);

        // City gets 80%
        assertEq(payouts[0].ambassadorId, 2);
        assertEq(payouts[0].amount, (totalPool * 8000) / 10000); // 200

        // State gets remaining 20%
        assertEq(payouts[1].ambassadorId, 1);
        assertEq(payouts[1].amount, totalPool - payouts[0].amount); // 50
    }

    function test_QueueReward_FailsBeforeCooldown() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));
        // Don't wait for cooldown

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, 1, 1000 * 10**18);

        assertEq(pendingRewardId, 0); // Should fail silently
    }

    function test_QueueReward_FailsBeforeActivation() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        // Only one order - seller not activated
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, 1, 1000 * 10**18);

        assertEq(pendingRewardId, 0); // Should fail silently
    }

    // ============ Reward Claiming Tests ============

    function test_ClaimVestedRewards_Chain() public {
        uint256 sellerId = _setupActivatedSellerWithChain();
        uint256 saleAmount = 1000 * 10**18;

        vm.prank(marketplace);
        rewards.queueReward(1, sellerId, saleAmount);

        // Wait for vesting period
        vm.warp(block.timestamp + VESTING_PERIOD);

        // Block ambassador claims
        uint256 blockBalanceBefore = token.balanceOf(blockAmbassador);
        vm.prank(blockAmbassador);
        rewards.claimVestedRewards();
        uint256 blockClaimed = token.balanceOf(blockAmbassador) - blockBalanceBefore;
        assertGt(blockClaimed, 0);

        // State founder claims
        uint256 stateBalanceBefore = token.balanceOf(stateFounder);
        vm.prank(stateFounder);
        rewards.claimVestedRewards();
        uint256 stateClaimed = token.balanceOf(stateFounder) - stateBalanceBefore;
        assertGt(stateClaimed, 0);

        // Block should have earned more than state founder (80% vs ~0.2%)
        assertGt(blockClaimed, stateClaimed);
    }

    function test_CannotClaimBeforeVesting() public {
        uint256 sellerId = _setupActivatedSellerWithChain();

        vm.prank(marketplace);
        rewards.queueReward(1, sellerId, 1000 * 10**18);

        vm.prank(blockAmbassador);
        vm.expectRevert("No rewards to claim");
        rewards.claimVestedRewards();
    }

    // ============ Clawback Tests ============

    function test_ClawbackReward_AllLevels() public {
        uint256 sellerId = _setupActivatedSellerWithChain();

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, 1000 * 10**18);

        // Get pending amounts before clawback
        AmbassadorRewards.Ambassador memory blockBefore = rewards.getAmbassador(4);
        AmbassadorRewards.Ambassador memory stateBefore = rewards.getAmbassador(1);

        vm.prank(marketplace);
        rewards.clawbackReward(1, "Order disputed");

        AmbassadorRewards.PendingReward memory reward = rewards.getPendingReward(pendingRewardId);
        assertTrue(reward.clawedBack);

        // All pending amounts should be reduced
        AmbassadorRewards.Ambassador memory blockAfter = rewards.getAmbassador(4);
        AmbassadorRewards.Ambassador memory stateAfter = rewards.getAmbassador(1);

        assertLt(blockAfter.totalPending, blockBefore.totalPending);
        assertLt(stateAfter.totalPending, stateBefore.totalPending);
    }

    // ============ Circuit Breaker Tests ============

    function test_DailyOutflowCap() public {
        uint256 sellerId = _setupActivatedSellerWithChain();

        // Daily cap is 0.5% of initial treasury
        uint256 dailyCap = (AMBASSADOR_ALLOCATION * 50) / 10000;

        // Queue a large reward that would exceed daily cap
        uint256 hugeAmount = dailyCap * 5; // 5x the daily cap worth of sales

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, hugeAmount);

        // Total distributed should not exceed daily cap
        AmbassadorRewards.PendingReward memory reward = rewards.getPendingReward(pendingRewardId);
        assertLe(reward.totalAmount, dailyCap);
    }

    function test_AmbassadorWeeklyCap() public {
        uint256 sellerId = _setupActivatedSellerWithChain();

        uint256 weeklyCap = 10_000 * 10**18;

        // Queue multiple rewards
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(marketplace);
            rewards.queueReward(i + 1, sellerId, 100_000 * 10**18);
        }

        // Block ambassador's pending should not exceed weekly cap
        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(4);
        assertLe(amb.totalPending, weeklyCap);
    }

    // ============ Reward Period Tests ============

    function test_NoRewardsAfterExpiry() public {
        uint256 sellerId = _setupActivatedSellerWithChain();

        // Fast forward past reward period
        vm.warp(block.timestamp + REWARD_DURATION + 1);

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, 1000 * 10**18);

        assertEq(pendingRewardId, 0);
    }

    // ============ View Function Tests ============

    function test_GetAmbassadorChain() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(cityAmbassador);
        rewards.registerAmbassador(1);

        vm.prank(neighborhoodAmbassador);
        rewards.registerAmbassador(2);

        uint256[] memory chain = rewards.getAmbassadorChain(3);
        assertEq(chain.length, 3);
        assertEq(chain[0], 3); // Neighborhood
        assertEq(chain[1], 2); // City
        assertEq(chain[2], 1); // State Founder
    }

    function test_GetAmbassadorId() public {
        assertEq(rewards.getAmbassadorId(stateFounder), 0);

        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        assertEq(rewards.getAmbassadorId(stateFounder), 1);
    }

    function test_IsAmbassadorActive() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        // Before cooldown
        assertFalse(rewards.isAmbassadorActive(1));

        // After cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);
        assertTrue(rewards.isAmbassadorActive(1));
    }

    function test_IsSellerActivated() public {
        rewards.registerStateFounder(stateFounder, bytes8("djq"));

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        assertFalse(rewards.isSellerActivated(1));

        // Activate
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        assertTrue(rewards.isSellerActivated(1));
    }

    // ============ Admin Tests ============

    function test_SetAdmin() public {
        address newAdmin = address(0x999);
        rewards.setAdmin(newAdmin);
        assertEq(rewards.admin(), newAdmin);
    }

    function test_RevertSetAdmin_NotAdmin() public {
        vm.prank(stateFounder);
        vm.expectRevert("Only admin");
        rewards.setAdmin(stateFounder);
    }

    function test_RevertSetMarketplace_AlreadySet() public {
        vm.expectRevert("Marketplace already set");
        rewards.setMarketplace(address(0x999));
    }

    function test_RevertSetMarketplace_ZeroAddress() public {
        AmbassadorRewards newRewards = new AmbassadorRewards(address(token));

        vm.expectRevert("Invalid marketplace address");
        newRewards.setMarketplace(address(0));
    }

    // ============ Constructor Validation Tests ============

    function test_RevertDeploy_ZeroToken() public {
        vm.expectRevert("Invalid token address");
        new AmbassadorRewards(address(0));
    }
}
