// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "../src/MockERC20.sol";

/**
 * @title Phase1SeedsTest
 * @notice Tests for Phase 1 functionality (USDC payments, Seeds events)
 */
contract Phase1SeedsTest is Test {
    LocalRootsMarketplace public marketplace;
    AmbassadorRewards public ambassadorRewards;
    MockUSDC public usdc;

    address public admin = address(0x1);
    address public seller1 = address(0x2);
    address public buyer1 = address(0x3);
    address public ambassador1 = address(0x4);

    bytes8 public geohash1 = bytes8("9q8yyk9");

    // USDC address that matches the hardcoded constant in LocalRootsMarketplace
    address constant EXPECTED_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant PRICE_PER_UNIT = 10 * 10**18;  // 10 ROOTS = $0.10 USD
    uint256 public constant INITIAL_USDC = 10000 * 10**6;   // 10,000 USDC

    // Events to test
    event SeedsEarned(address indexed user, uint256 amount, string reason, uint256 orderId);
    event SellerMilestoneSeeds(address indexed seller, uint256 indexed sellerId, uint256 amount, string milestone);
    event AmbassadorSeedsEarned(uint256 indexed ambassadorId, uint256 seedsAmount, uint256 orderId, uint256 chainLevel);

    function setUp() public {
        // Deploy mock USDC at the expected address using vm.etch
        usdc = new MockUSDC();
        bytes memory usdcCode = address(usdc).code;
        vm.etch(EXPECTED_USDC, usdcCode);
        usdc = MockUSDC(EXPECTED_USDC);

        // Deploy AmbassadorRewards (with a dummy token address)
        ambassadorRewards = new AmbassadorRewards(address(usdc), address(0));

        // Deploy marketplace in Phase 1 mode
        marketplace = new LocalRootsMarketplace(
            address(0),  // No ROOTS token in Phase 1
            address(ambassadorRewards),
            address(0),  // No forwarder in tests
            admin,
            LocalRootsMarketplace.LaunchPhase.Phase1_USDC
        );

        // Configure ambassador rewards
        ambassadorRewards.setMarketplace(address(marketplace));

        // Fund buyer with USDC
        usdc.mint(buyer1, INITIAL_USDC);
    }

    // ============ Phase 1 USDC Payment Tests ============

    function test_Phase1_USDCPaymentOnly() public {
        // Register seller and create listing
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        // Calculate USDC amount (10 ROOTS * 5 qty / 100 ROOTS per USD / 1e12)
        // = 50 ROOTS / 100 / 1e12 = 0.5 USD = 500000 (in USDC 6 decimals)
        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;

        // Approve and purchase with USDC
        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);

        // Must use USDC in Phase 1
        uint256 orderId = marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();

        // Verify order was created with USDC
        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(order.totalPrice, expectedUSDC);
        assertEq(order.paymentToken, address(usdc));
    }

    function test_Phase1_RevertNonUSDCPayment() public {
        // Register seller and create listing
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        // Try to pay with address(0) (ROOTS) - should fail
        vm.startPrank(buyer1);
        vm.expectRevert("Phase 1: USDC only");
        marketplace.purchase(1, 5, false, "", address(0));
        vm.stopPrank();
    }

    // ============ Seeds Event Tests ============

    function test_Phase1_EmitsSeedsOnPurchase() public {
        // Register seller
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;

        // Approve and purchase
        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);

        // Expect SeedsEarned event for buyer (50 Seeds per $1 USDC)
        // expectedUSDC * 50 = Seeds amount
        vm.expectEmit(true, false, false, true);
        emit SeedsEarned(buyer1, expectedUSDC * 50, "purchase", 1);

        marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();
    }

    function test_Phase1_EmitsSeedsOnOrderComplete() public {
        // Setup purchase
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;

        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);
        uint256 orderId = marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();

        // Accept and mark ready
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Complete order - should emit Seeds for seller (500 Seeds per $1)
        vm.prank(buyer1);
        vm.expectEmit(true, false, false, true);
        emit SeedsEarned(seller1, expectedUSDC * 500, "sale", orderId);
        marketplace.completeOrder(orderId);
    }

    // ============ Seller Milestone Tests ============

    function test_Phase1_NoProfileCompletedMilestone() public {
        // Profile completion should NOT emit Seeds - we reward action, not signup
        // Just verify registration succeeds without Seeds event
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        // Verify seller was registered (no Seeds emitted for profile completion)
        assertEq(marketplace.sellerIdByOwner(seller1), 1);
    }

    function test_Phase1_FirstListingMilestone() public {
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        // Expect first_listing milestone on first listing (50 Seeds - minimal reward)
        vm.expectEmit(true, true, false, true);
        emit SellerMilestoneSeeds(seller1, 1, 50 * 1e6, "first_listing");

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
    }

    function test_Phase1_FirstSaleMilestone() public {
        // Setup
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;

        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);
        uint256 orderId = marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Complete first order - should emit first_sale milestone
        vm.prank(buyer1);
        vm.expectEmit(true, true, false, true);
        emit SellerMilestoneSeeds(seller1, 1, 10000 * 1e6, "first_sale");
        marketplace.completeOrder(orderId);
    }

    // ============ Phase Transition Tests ============

    function test_PhaseTransition() public {
        // Verify starting in Phase 1
        assertEq(uint(marketplace.currentPhase()), uint(LocalRootsMarketplace.LaunchPhase.Phase1_USDC));

        // Transition to Phase 2
        vm.prank(admin);
        marketplace.transitionToPhase2(address(usdc));  // Using USDC as dummy token

        // Verify now in Phase 2
        assertEq(uint(marketplace.currentPhase()), uint(LocalRootsMarketplace.LaunchPhase.Phase2_ROOTS));
    }

    function test_RevertPhaseTransition_AlreadyPhase2() public {
        vm.prank(admin);
        marketplace.transitionToPhase2(address(usdc));

        vm.prank(admin);
        vm.expectRevert("Already in Phase 2");
        marketplace.transitionToPhase2(address(usdc));
    }

    function test_RevertPhaseTransition_NotAdmin() public {
        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        marketplace.transitionToPhase2(address(usdc));
    }

    // ============ Escrow Tests ============

    function test_Phase1_USDCEscrowAndRelease() public {
        // Setup
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;
        uint256 sellerBalanceBefore = usdc.balanceOf(seller1);

        // Purchase
        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);
        uint256 orderId = marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();

        // Verify USDC is in escrow
        assertEq(usdc.balanceOf(address(marketplace)), expectedUSDC);

        // Complete order flow
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        vm.prank(buyer1);
        marketplace.completeOrder(orderId);

        // Warp past dispute window
        vm.warp(block.timestamp + 3 days);

        // Seller claims funds
        vm.prank(seller1);
        marketplace.claimFunds(orderId);

        // Verify USDC transferred to seller
        assertEq(usdc.balanceOf(seller1), sellerBalanceBefore + expectedUSDC);
        assertEq(usdc.balanceOf(address(marketplace)), 0);
    }

    function test_Phase1_USDCRefund() public {
        // Setup
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);

        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        uint256 expectedUSDC = (PRICE_PER_UNIT * 5) / 100 / 1e12;
        uint256 buyerBalanceBefore = usdc.balanceOf(buyer1);

        // Purchase
        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUSDC);
        uint256 orderId = marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();

        // Complete order flow
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Buyer raises dispute
        vm.prank(buyer1);
        marketplace.raiseDispute(orderId);

        // Seller refunds
        vm.prank(seller1);
        marketplace.refundBuyer(orderId);

        // Verify USDC returned to buyer
        assertEq(usdc.balanceOf(buyer1), buyerBalanceBefore);
    }
}
