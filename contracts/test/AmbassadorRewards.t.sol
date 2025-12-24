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

    address public ambassador1 = address(0x100);
    address public ambassador2 = address(0x101);
    address public ambassador3 = address(0x102);
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

    function test_AmbassadorRewardBPS() public view {
        assertEq(rewards.AMBASSADOR_REWARD_BPS(), 2500); // 25%
    }

    function test_SeniorCutBPS() public view {
        assertEq(rewards.SENIOR_CUT_BPS(), 500); // 5%
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

    // ============ Ambassador Registration Tests ============

    function test_RegisterAmbassador() public {
        vm.prank(ambassador1);
        uint256 id = rewards.registerAmbassador(0); // no senior

        assertEq(id, 1);
        assertEq(rewards.getAmbassadorId(ambassador1), 1);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertEq(amb.wallet, ambassador1);
        assertEq(amb.seniorAmbassadorId, 0);
        assertEq(amb.totalEarned, 0);
        assertEq(amb.totalPending, 0);
        assertEq(amb.recruitedSellers, 0);
        assertEq(amb.recruitedAmbassadors, 0);
        assertTrue(amb.active);
        assertFalse(amb.suspended);
    }

    function test_RegisterWithSenior() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        vm.prank(ambassador2);
        uint256 id = rewards.registerAmbassador(1); // senior is ambassador1

        assertEq(id, 2);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(2);
        assertEq(amb.seniorAmbassadorId, 1);

        // Check senior's count updated
        AmbassadorRewards.Ambassador memory senior = rewards.getAmbassador(1);
        assertEq(senior.recruitedAmbassadors, 1);
    }

    function test_RevertRegister_AlreadyAmbassador() public {
        vm.startPrank(ambassador1);
        rewards.registerAmbassador(0);

        vm.expectRevert("Already an ambassador");
        rewards.registerAmbassador(0);
        vm.stopPrank();
    }

    function test_RevertRegister_InvalidSenior() public {
        vm.prank(ambassador1);
        vm.expectRevert("Invalid senior ambassador");
        rewards.registerAmbassador(999);
    }

    // ============ Seller Recruitment Tests ============

    function test_RecordSellerRecruitment() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

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
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        vm.prank(ambassador1);
        vm.expectRevert("Only marketplace");
        rewards.recordSellerRecruitment(1, 1);
    }

    // ============ Seller Activation Tests (Circuit Breaker) ============

    function test_SellerActivation() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

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
        assertFalse(recruitment.activated); // Still not activated - need 2 unique buyers

        // Third order from different buyer - activates!
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        recruitment = rewards.getSellerRecruitment(1);
        assertEq(recruitment.completedOrderCount, 3);
        assertEq(recruitment.uniqueBuyerCount, 2);
        assertTrue(recruitment.activated);
    }

    // ============ Reward Queueing Tests ============

    function _setupActivatedSeller() internal returns (uint256 sellerId) {
        sellerId = 1;

        // Register ambassador and wait for cooldown
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Recruit seller
        vm.prank(marketplace);
        rewards.recordSellerRecruitment(sellerId, 1);

        // Activate seller (2 orders from 2 unique buyers)
        vm.prank(marketplace);
        rewards.recordCompletedOrder(sellerId, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(sellerId, buyer2);
    }

    function test_QueueReward() public {
        uint256 sellerId = _setupActivatedSeller();
        uint256 saleAmount = 1000 * 10**18;
        uint256 expectedReward = (saleAmount * 2500) / 10000; // 25%

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, saleAmount);

        assertGt(pendingRewardId, 0);

        AmbassadorRewards.PendingReward memory reward = rewards.getPendingReward(pendingRewardId);
        assertEq(reward.orderId, 1);
        assertEq(reward.sellerId, sellerId);
        assertEq(reward.ambassadorId, 1);
        assertEq(reward.ambassadorAmount, expectedReward);
        assertEq(reward.vestingEndsAt, block.timestamp + VESTING_PERIOD);
        assertFalse(reward.claimed);
        assertFalse(reward.clawedBack);

        // Ambassador should have pending balance
        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertEq(amb.totalPending, expectedReward);
        assertEq(amb.totalEarned, 0); // Not earned until claimed
    }

    function test_QueueReward_FailsBeforeCooldown() public {
        // Register ambassador but don't wait for cooldown
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        // Activate seller
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        // Try to queue reward before cooldown
        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, 1, 1000 * 10**18);

        assertEq(pendingRewardId, 0); // Should fail silently
    }

    function test_QueueReward_FailsBeforeActivation() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);
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

    function test_ClaimVestedRewards() public {
        uint256 sellerId = _setupActivatedSeller();
        uint256 saleAmount = 1000 * 10**18;
        uint256 expectedReward = (saleAmount * 2500) / 10000;

        vm.prank(marketplace);
        rewards.queueReward(1, sellerId, saleAmount);

        // Cannot claim before vesting
        vm.prank(ambassador1);
        vm.expectRevert("No rewards to claim");
        rewards.claimVestedRewards();

        // Wait for vesting period
        vm.warp(block.timestamp + VESTING_PERIOD);

        uint256 balanceBefore = token.balanceOf(ambassador1);

        vm.prank(ambassador1);
        rewards.claimVestedRewards();

        assertEq(token.balanceOf(ambassador1), balanceBefore + expectedReward);

        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertEq(amb.totalEarned, expectedReward);
        assertEq(amb.totalPending, 0);
    }

    function test_ClaimWithSeniorRewards() public {
        // Register senior ambassador
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        // Register junior with senior
        vm.prank(ambassador2);
        rewards.registerAmbassador(1);

        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Junior recruits seller
        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 2);

        // Activate seller
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer1);
        vm.prank(marketplace);
        rewards.recordCompletedOrder(1, buyer2);

        uint256 saleAmount = 1000 * 10**18;
        uint256 totalReward = (saleAmount * 2500) / 10000; // 250
        uint256 seniorCut = (totalReward * 500) / 2500; // 50
        uint256 juniorReward = totalReward - seniorCut; // 200

        vm.prank(marketplace);
        rewards.queueReward(1, 1, saleAmount);

        vm.warp(block.timestamp + VESTING_PERIOD);

        // Junior claims
        uint256 juniorBalanceBefore = token.balanceOf(ambassador2);
        vm.prank(ambassador2);
        rewards.claimVestedRewards();
        assertEq(token.balanceOf(ambassador2), juniorBalanceBefore + juniorReward);

        // Senior claims
        uint256 seniorBalanceBefore = token.balanceOf(ambassador1);
        vm.prank(ambassador1);
        rewards.claimVestedRewards();
        assertEq(token.balanceOf(ambassador1), seniorBalanceBefore + seniorCut);
    }

    // ============ Clawback Tests ============

    function test_ClawbackReward() public {
        uint256 sellerId = _setupActivatedSeller();

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, 1000 * 10**18);

        AmbassadorRewards.Ambassador memory ambBefore = rewards.getAmbassador(1);
        uint256 pendingBefore = ambBefore.totalPending;

        vm.prank(marketplace);
        rewards.clawbackReward(1, "Order disputed");

        AmbassadorRewards.PendingReward memory reward = rewards.getPendingReward(pendingRewardId);
        assertTrue(reward.clawedBack);

        AmbassadorRewards.Ambassador memory ambAfter = rewards.getAmbassador(1);
        assertEq(ambAfter.totalPending, pendingBefore - reward.ambassadorAmount);
    }

    // ============ Circuit Breaker Tests ============

    function test_DailyOutflowCap() public {
        uint256 sellerId = _setupActivatedSeller();

        // Daily cap is 0.5% of initial treasury
        uint256 dailyCap = (AMBASSADOR_ALLOCATION * 50) / 10000;

        // Queue a large reward that would exceed daily cap
        uint256 hugeAmount = dailyCap * 5; // 5x the daily cap worth of sales

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, hugeAmount);

        // Should only queue up to the daily cap
        AmbassadorRewards.PendingReward memory reward = rewards.getPendingReward(pendingRewardId);
        assertLe(reward.ambassadorAmount, dailyCap);
    }

    function test_AmbassadorWeeklyCap() public {
        uint256 sellerId = _setupActivatedSeller();

        uint256 weeklyCap = 10_000 * 10**18; // 10,000 ROOTS

        // Queue multiple rewards that would exceed weekly cap
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(marketplace);
            rewards.queueReward(i + 1, sellerId, 100_000 * 10**18); // Each would be 25,000 ROOTS reward
        }

        // Total pending should not exceed weekly cap
        AmbassadorRewards.Ambassador memory amb = rewards.getAmbassador(1);
        assertLe(amb.totalPending, weeklyCap);
    }

    // ============ Reward Period Tests ============

    function test_NoRewardsAfterExpiry() public {
        uint256 sellerId = _setupActivatedSeller();

        // Fast forward past reward period
        vm.warp(block.timestamp + REWARD_DURATION + 1);

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, 1000 * 10**18);

        assertEq(pendingRewardId, 0); // Should fail - reward period expired
    }

    function test_RewardsActiveJustBeforeExpiry() public {
        uint256 sellerId = _setupActivatedSeller();

        // Just before expiry
        vm.warp(block.timestamp + REWARD_DURATION - 1);

        vm.prank(marketplace);
        uint256 pendingRewardId = rewards.queueReward(1, sellerId, 1000 * 10**18);

        assertGt(pendingRewardId, 0); // Should succeed
    }

    // ============ View Function Tests ============

    function test_IsRewardPeriodActive() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        // Before recruitment
        assertFalse(rewards.isRewardPeriodActive(1));

        vm.prank(marketplace);
        rewards.recordSellerRecruitment(1, 1);

        // After recruitment
        assertTrue(rewards.isRewardPeriodActive(1));

        // After expiry
        vm.warp(block.timestamp + REWARD_DURATION + 1);
        assertFalse(rewards.isRewardPeriodActive(1));
    }

    function test_GetAmbassadorId() public {
        assertEq(rewards.getAmbassadorId(ambassador1), 0);

        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        assertEq(rewards.getAmbassadorId(ambassador1), 1);
    }

    function test_IsAmbassadorActive() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

        // Before cooldown
        assertFalse(rewards.isAmbassadorActive(1));

        // After cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);
        assertTrue(rewards.isAmbassadorActive(1));
    }

    function test_IsSellerActivated() public {
        vm.prank(ambassador1);
        rewards.registerAmbassador(0);

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

    function test_RevertSetMarketplace_AlreadySet() public {
        vm.expectRevert("Marketplace already set");
        rewards.setMarketplace(address(0x999));
    }

    function test_RevertSetMarketplace_ZeroAddress() public {
        // Deploy fresh rewards
        AmbassadorRewards newRewards = new AmbassadorRewards(address(token));

        vm.expectRevert("Invalid marketplace address");
        newRewards.setMarketplace(address(0));
    }

    // ============ Constructor Validation Tests ============

    function test_RevertDeploy_ZeroToken() public {
        vm.expectRevert("Invalid token address");
        new AmbassadorRewards(address(0));
    }

    // ============ Deprecated Function Test ============

    function test_RevertDistributeRewards_Deprecated() public {
        vm.prank(marketplace);
        vm.expectRevert("Use queueReward instead");
        rewards.distributeRewards(1, 1000 * 10**18);
    }
}
