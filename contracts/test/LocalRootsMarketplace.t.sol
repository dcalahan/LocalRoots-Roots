// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";

contract LocalRootsMarketplaceTest is Test {
    RootsToken public token;
    LocalRootsMarketplace public marketplace;
    AmbassadorRewards public ambassadorRewardsContract;

    address public founderVesting = address(0x1);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);

    address public seller1 = address(0x100);
    address public seller2 = address(0x101);
    address public buyer1 = address(0x200);
    address public buyer2 = address(0x201);

    bytes8 public geohash1 = bytes8("9q8yyk9");  // San Francisco area
    bytes8 public geohash2 = bytes8("9q5ctr9");  // Los Angeles area

    uint256 public constant INITIAL_BALANCE = 10_000 * 10**18;
    uint256 public constant PRICE_PER_UNIT = 10 * 10**18; // 10 ROOTS per unit
    uint256 public constant AMBASSADOR_ALLOCATION = 25_000_000 * 10**18;

    function setUp() public {
        // Deploy ambassador rewards first (with temp token address)
        ambassadorRewardsContract = new AmbassadorRewards(address(1));

        // Deploy token with ambassador rewards address
        token = new RootsToken(
            founderVesting,
            address(ambassadorRewardsContract),
            liquidityPool,
            treasury,
            airdrop
        );

        // Redeploy ambassador rewards with correct token
        ambassadorRewardsContract = new AmbassadorRewards(address(token));

        // Fund ambassador treasury
        vm.prank(treasury);
        token.transfer(address(ambassadorRewardsContract), AMBASSADOR_ALLOCATION);

        // Deploy marketplace
        marketplace = new LocalRootsMarketplace(
            address(token),
            address(ambassadorRewardsContract)
        );

        // Set marketplace in ambassador rewards
        ambassadorRewardsContract.setMarketplace(address(marketplace));

        // Fund test accounts from treasury
        vm.startPrank(treasury);
        token.transfer(seller1, INITIAL_BALANCE);
        token.transfer(seller2, INITIAL_BALANCE);
        token.transfer(buyer1, INITIAL_BALANCE);
        token.transfer(buyer2, INITIAL_BALANCE);
        vm.stopPrank();
    }

    // ============ Seller Registration Tests ============

    function test_RegisterSeller() public {
        vm.prank(seller1);
        uint256 sellerId = marketplace.registerSeller(
            geohash1,
            "ipfs://storefront1",
            true,  // offers delivery
            true,  // offers pickup
            10     // 10km radius
        );

        assertEq(sellerId, 1);
        assertEq(marketplace.sellerIdByOwner(seller1), 1);

        (
            address owner,
            bytes8 geohash,
            string memory storefrontIpfs,
            bool offersDelivery,
            bool offersPickup,
            uint256 deliveryRadiusKm,
            uint256 createdAt,
            bool active
        ) = marketplace.sellers(1);

        assertEq(owner, seller1);
        assertEq(geohash, geohash1);
        assertEq(storefrontIpfs, "ipfs://storefront1");
        assertTrue(offersDelivery);
        assertTrue(offersPickup);
        assertEq(deliveryRadiusKm, 10);
        assertGt(createdAt, 0);
        assertTrue(active);
    }

    function test_RegisterMultipleSellers() public {
        vm.prank(seller1);
        uint256 id1 = marketplace.registerSeller(geohash1, "ipfs://1", true, true, 10);

        vm.prank(seller2);
        uint256 id2 = marketplace.registerSeller(geohash2, "ipfs://2", false, true, 0);

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RevertRegister_AlreadyRegistered() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://1", true, true, 10);

        vm.expectRevert("Already registered as seller");
        marketplace.registerSeller(geohash1, "ipfs://2", true, true, 10);
        vm.stopPrank();
    }

    function test_RevertRegister_NoDeliveryOrPickup() public {
        vm.prank(seller1);
        vm.expectRevert("Must offer delivery or pickup");
        marketplace.registerSeller(geohash1, "ipfs://1", false, false, 10);
    }

    function test_GeohashIndexing() public {
        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://1", true, true, 10);

        // Test city level (4 chars, ~20km)
        bytes4 prefix4 = bytes4(geohash1);
        uint256[] memory sellersCity = marketplace.getSellersByCity(prefix4);
        assertEq(sellersCity.length, 1);
        assertEq(sellersCity[0], 1);

        // Test neighborhood level (5 chars, ~2.4km) - DEFAULT
        bytes5 prefix5 = bytes5(geohash1);
        uint256[] memory sellersNeighborhood = marketplace.getSellersByNeighborhood(prefix5);
        assertEq(sellersNeighborhood.length, 1);
        assertEq(sellersNeighborhood[0], 1);

        // Test block level (6 chars, ~610m)
        bytes6 prefix6 = bytes6(geohash1);
        uint256[] memory sellersBlock = marketplace.getSellersByBlock(prefix6);
        assertEq(sellersBlock.length, 1);
        assertEq(sellersBlock[0], 1);
    }

    function test_GeohashPrecisionLevels() public {
        // Register two sellers: same city (4 chars), different neighborhoods (5 chars)
        // geohashA = "9q8yak9a" -> city "9q8y", neighborhood "9q8ya"
        // geohashB = "9q8ybm2b" -> city "9q8y", neighborhood "9q8yb"
        bytes8 geohashA = bytes8("9q8yak9a");
        bytes8 geohashB = bytes8("9q8ybm2b");

        vm.prank(seller1);
        marketplace.registerSeller(geohashA, "ipfs://1", true, true, 10);

        vm.prank(seller2);
        marketplace.registerSeller(geohashB, "ipfs://2", true, true, 10);

        // City level (4 chars ~20km) - should find BOTH sellers
        uint256[] memory cityResults = marketplace.getSellersByCity(bytes4("9q8y"));
        assertEq(cityResults.length, 2);

        // Neighborhood level (5 chars ~2.4km) - should find only ONE each
        uint256[] memory neighborhoodA = marketplace.getSellersByNeighborhood(bytes5("9q8ya"));
        assertEq(neighborhoodA.length, 1);
        assertEq(neighborhoodA[0], 1); // seller1

        uint256[] memory neighborhoodB = marketplace.getSellersByNeighborhood(bytes5("9q8yb"));
        assertEq(neighborhoodB.length, 1);
        assertEq(neighborhoodB[0], 2); // seller2
    }

    // ============ Seller Update Tests ============

    function test_UpdateSeller() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://1", true, true, 10);

        marketplace.updateSeller(
            "ipfs://updated",
            false,  // no delivery
            true,   // pickup only
            0,
            true    // still active
        );
        vm.stopPrank();

        (, , string memory storefrontIpfs, bool offersDelivery, bool offersPickup, , , ) =
            marketplace.sellers(1);

        assertEq(storefrontIpfs, "ipfs://updated");
        assertFalse(offersDelivery);
        assertTrue(offersPickup);
    }

    function test_DeactivateSeller() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://1", true, true, 10);
        marketplace.updateSeller("ipfs://1", true, true, 10, false);
        vm.stopPrank();

        (, , , , , , , bool active) = marketplace.sellers(1);
        assertFalse(active);
    }

    function test_RevertUpdate_NotSeller() public {
        vm.prank(seller1);
        vm.expectRevert("Not a registered seller");
        marketplace.updateSeller("ipfs://1", true, true, 10, true);
    }

    // ============ Listing Tests ============

    function test_CreateListing() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);

        uint256 listingId = marketplace.createListing(
            "ipfs://tomatoes",
            PRICE_PER_UNIT,
            100  // 100 units available
        );
        vm.stopPrank();

        assertEq(listingId, 1);

        (
            uint256 sellerId,
            string memory metadataIpfs,
            uint256 pricePerUnit,
            uint256 quantityAvailable,
            bool active
        ) = marketplace.listings(1);

        assertEq(sellerId, 1);
        assertEq(metadataIpfs, "ipfs://tomatoes");
        assertEq(pricePerUnit, PRICE_PER_UNIT);
        assertEq(quantityAvailable, 100);
        assertTrue(active);
    }

    function test_CreateMultipleListings() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);

        uint256 id1 = marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        uint256 id2 = marketplace.createListing("ipfs://cucumbers", PRICE_PER_UNIT * 2, 50);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_RevertListing_NotSeller() public {
        vm.prank(buyer1);
        vm.expectRevert("Not a registered seller");
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
    }

    function test_RevertListing_InactiveSeller() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.updateSeller("ipfs://store", true, true, 10, false);

        vm.expectRevert("Seller not active");
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();
    }

    function test_RevertListing_ZeroPrice() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);

        vm.expectRevert("Price must be > 0");
        marketplace.createListing("ipfs://tomatoes", 0, 100);
        vm.stopPrank();
    }

    function test_RevertListing_ZeroQuantity() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);

        vm.expectRevert("Quantity must be > 0");
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 0);
        vm.stopPrank();
    }

    function test_UpdateListing() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);

        marketplace.updateListing(
            1,
            "ipfs://tomatoes-v2",
            PRICE_PER_UNIT * 2,
            50,
            true
        );
        vm.stopPrank();

        (, string memory metadataIpfs, uint256 pricePerUnit, uint256 quantityAvailable, ) =
            marketplace.listings(1);

        assertEq(metadataIpfs, "ipfs://tomatoes-v2");
        assertEq(pricePerUnit, PRICE_PER_UNIT * 2);
        assertEq(quantityAvailable, 50);
    }

    // ============ Purchase Tests ============

    function test_Purchase_FundsHeldInEscrow() public {
        // Setup seller and listing
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        // Approve marketplace
        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);

        uint256 quantity = 5;
        uint256 expectedTotal = PRICE_PER_UNIT * quantity; // 50 ROOTS

        uint256 buyerBalanceBefore = token.balanceOf(buyer1);
        uint256 sellerBalanceBefore = token.balanceOf(seller1);
        uint256 marketplaceBalanceBefore = token.balanceOf(address(marketplace));

        uint256 orderId = marketplace.purchase(1, quantity, false);
        vm.stopPrank();

        assertEq(orderId, 1);
        // Buyer pays exact price
        assertEq(token.balanceOf(buyer1), buyerBalanceBefore - expectedTotal);
        // Seller has NOT received funds yet (held in escrow)
        assertEq(token.balanceOf(seller1), sellerBalanceBefore);
        // Marketplace holds the funds
        assertEq(token.balanceOf(address(marketplace)), marketplaceBalanceBefore + expectedTotal);

        // Check listing quantity decreased
        (, , , uint256 quantityAvailable, ) = marketplace.listings(1);
        assertEq(quantityAvailable, 95);
    }

    function test_FundsNotReleasedUntilDisputeWindowExpires() public {
        // Setup seller and listing
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        // Buyer purchases
        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);
        uint256 orderId = marketplace.purchase(1, 5, false);
        vm.stopPrank();

        uint256 expectedTotal = PRICE_PER_UNIT * 5;
        uint256 sellerBalanceBefore = token.balanceOf(seller1);

        // Seller accepts and provides proof
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof-photo");
        vm.stopPrank();

        // Seller has NOT received funds yet (dispute window active)
        assertEq(token.balanceOf(seller1), sellerBalanceBefore);
        // Marketplace still holds funds
        assertEq(token.balanceOf(address(marketplace)), expectedTotal);

        // Check order has proof but funds NOT released
        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(order.proofIpfs, "ipfs://proof-photo");
        assertFalse(order.fundsReleased);
        assertGt(order.proofUploadedAt, 0);
    }

    function test_SellerClaimsFundsAfterDisputeWindow() public {
        // Setup seller and listing
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        // Buyer purchases
        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);
        uint256 orderId = marketplace.purchase(1, 5, false);
        vm.stopPrank();

        uint256 expectedTotal = PRICE_PER_UNIT * 5;
        uint256 sellerBalanceBefore = token.balanceOf(seller1);

        // Seller accepts and provides proof
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof-photo");

        // Try to claim immediately - should fail
        vm.expectRevert("Dispute window not expired");
        marketplace.claimFunds(orderId);

        // Wait for dispute window to expire (2 days)
        vm.warp(block.timestamp + 2 days + 1);

        // Now seller can claim
        marketplace.claimFunds(orderId);
        vm.stopPrank();

        // Seller now receives 100% of funds
        assertEq(token.balanceOf(seller1), sellerBalanceBefore + expectedTotal);
        // Marketplace no longer holds funds
        assertEq(token.balanceOf(address(marketplace)), 0);

        // Check funds released flag
        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertTrue(order.fundsReleased);
    }

    function test_EscrowWorksWithEmptyTreasury() public {
        // Deploy fresh contracts with NO treasury funding
        // to verify escrow still works
        AmbassadorRewards freshAmbassador = new AmbassadorRewards(address(token));
        LocalRootsMarketplace freshMarketplace = new LocalRootsMarketplace(
            address(token),
            address(freshAmbassador)
        );
        freshAmbassador.setMarketplace(address(freshMarketplace));

        // Setup seller and listing
        vm.startPrank(seller1);
        freshMarketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        freshMarketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        // Approve marketplace
        vm.startPrank(buyer1);
        token.approve(address(freshMarketplace), type(uint256).max);

        uint256 quantity = 5;
        uint256 expectedTotal = PRICE_PER_UNIT * quantity; // 50 ROOTS

        uint256 buyerBalanceBefore = token.balanceOf(buyer1);
        uint256 sellerBalanceBefore = token.balanceOf(seller1);

        uint256 orderId = freshMarketplace.purchase(1, quantity, false);
        vm.stopPrank();

        // Buyer pays exact price
        assertEq(token.balanceOf(buyer1), buyerBalanceBefore - expectedTotal);
        // Funds in escrow, not with seller yet
        assertEq(token.balanceOf(seller1), sellerBalanceBefore);
        assertEq(token.balanceOf(address(freshMarketplace)), expectedTotal);

        // Seller provides proof
        vm.startPrank(seller1);
        freshMarketplace.acceptOrder(orderId);
        freshMarketplace.markReadyForPickup(orderId, "ipfs://proof");

        // Funds still in escrow during dispute window
        assertEq(token.balanceOf(seller1), sellerBalanceBefore);

        // Wait for dispute window to expire
        vm.warp(block.timestamp + 2 days + 1);

        // Seller claims funds
        freshMarketplace.claimFunds(orderId);
        vm.stopPrank();

        // Seller receives 100% after claim
        assertEq(token.balanceOf(seller1), sellerBalanceBefore + expectedTotal);
    }

    function test_PurchaseWithDelivery() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);
        uint256 orderId = marketplace.purchase(1, 5, true); // isDelivery = true
        vm.stopPrank();

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertTrue(order.isDelivery);
    }

    function test_RevertPurchase_InactiveListing() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        marketplace.updateListing(1, "ipfs://tomatoes", PRICE_PER_UNIT, 100, false);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);

        vm.expectRevert("Listing not active");
        marketplace.purchase(1, 5, false);
        vm.stopPrank();
    }

    function test_RevertPurchase_InsufficientQuantity() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 10);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);

        vm.expectRevert("Insufficient quantity");
        marketplace.purchase(1, 15, false);
        vm.stopPrank();
    }

    function test_RevertPurchase_DeliveryNotOffered() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", false, true, 0); // pickup only
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);

        vm.expectRevert("Seller does not offer delivery");
        marketplace.purchase(1, 5, true);
        vm.stopPrank();
    }

    function test_RevertPurchase_PickupNotOffered() public {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, false, 10); // delivery only
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);

        vm.expectRevert("Seller does not offer pickup");
        marketplace.purchase(1, 5, false);
        vm.stopPrank();
    }

    // ============ Order Management Tests ============

    function _createOrderFixture() internal returns (uint256 orderId) {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);
        orderId = marketplace.purchase(1, 5, false);
        vm.stopPrank();
    }

    function test_AcceptOrder() public {
        uint256 orderId = _createOrderFixture();

        vm.prank(seller1);
        marketplace.acceptOrder(orderId);

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.Accepted));
    }

    function test_MarkReadyForPickup() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof-pickup");
        vm.stopPrank();

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.ReadyForPickup));
        assertEq(order.proofIpfs, "ipfs://proof-pickup");
        assertGt(order.proofUploadedAt, 0);
        assertFalse(order.fundsReleased); // Funds held until dispute window expires
    }

    function test_MarkOutForDelivery() public {
        // Create order with delivery
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);
        marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        vm.startPrank(buyer1);
        token.approve(address(marketplace), type(uint256).max);
        uint256 orderId = marketplace.purchase(1, 5, true); // delivery
        vm.stopPrank();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markOutForDelivery(orderId, "ipfs://proof-delivery");
        vm.stopPrank();

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.OutForDelivery));
        assertEq(order.proofIpfs, "ipfs://proof-delivery");
        assertGt(order.proofUploadedAt, 0);
        assertFalse(order.fundsReleased); // Funds held until dispute window expires
    }

    function test_CompleteOrder() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        vm.prank(buyer1);
        marketplace.completeOrder(orderId);

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.Completed));
        assertGt(order.completedAt, 0);
    }

    function test_RevertComplete_NotBuyer() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");

        vm.expectRevert("Not order buyer");
        marketplace.completeOrder(orderId);
        vm.stopPrank();
    }

    function test_RevertMarkReadyForPickup_NoProof() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);

        vm.expectRevert("Proof photo required");
        marketplace.markReadyForPickup(orderId, "");
        vm.stopPrank();
    }

    // ============ Dispute Tests ============

    function test_RaiseDispute() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        vm.prank(buyer1);
        marketplace.raiseDispute(orderId);

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.Disputed));
    }

    function test_RaiseDisputeAfterCompletion() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        vm.startPrank(buyer1);
        marketplace.completeOrder(orderId);

        // Can dispute within 2 days
        vm.warp(block.timestamp + 1 days);
        marketplace.raiseDispute(orderId);
        vm.stopPrank();

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.Disputed));
    }

    function test_RevertDispute_WindowExpired() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        vm.startPrank(buyer1);
        marketplace.completeOrder(orderId);

        // Try to dispute after 2 days
        vm.warp(block.timestamp + 3 days);
        vm.expectRevert("Dispute window expired");
        marketplace.raiseDispute(orderId);
        vm.stopPrank();
    }

    function test_RevertDispute_NotBuyer() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");

        vm.expectRevert("Not order buyer");
        marketplace.raiseDispute(orderId);
        vm.stopPrank();
    }

    // ============ Refund Tests ============

    function test_RefundBuyer() public {
        uint256 orderId = _createOrderFixture();
        uint256 expectedTotal = PRICE_PER_UNIT * 5;

        // Buyer balance after purchase (funds in escrow)
        uint256 buyerBalanceAfterPurchase = token.balanceOf(buyer1);

        vm.prank(seller1);
        marketplace.acceptOrder(orderId);

        // Buyer disputes before seller provides proof (funds still in escrow)
        vm.prank(buyer1);
        marketplace.raiseDispute(orderId);

        // Seller voluntarily refunds
        vm.prank(seller1);
        marketplace.refundBuyer(orderId);

        // Buyer gets refund
        assertEq(token.balanceOf(buyer1), buyerBalanceAfterPurchase + expectedTotal);

        LocalRootsMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(LocalRootsMarketplace.OrderStatus.Refunded));
        assertTrue(order.fundsReleased);
    }

    function test_RevertRefund_NotDisputed() public {
        uint256 orderId = _createOrderFixture();

        vm.prank(seller1);
        marketplace.acceptOrder(orderId);

        vm.prank(seller1);
        vm.expectRevert("Order not disputed");
        marketplace.refundBuyer(orderId);
    }

    function test_RevertClaimFunds_OrderDisputed() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Buyer raises dispute before window expires
        vm.prank(buyer1);
        marketplace.raiseDispute(orderId);

        // Even after dispute window expires, seller can't claim disputed order
        // (Disputed status is not in allowed statuses list)
        vm.warp(block.timestamp + 2 days + 1);
        vm.prank(seller1);
        vm.expectRevert("Invalid order status");
        marketplace.claimFunds(orderId);
    }

    function test_RevertClaimFunds_DoubleClaim() public {
        uint256 orderId = _createOrderFixture();

        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Wait for dispute window to expire and claim
        vm.warp(block.timestamp + 2 days + 1);
        vm.prank(seller1);
        marketplace.claimFunds(orderId);

        // Try to claim again
        vm.prank(seller1);
        vm.expectRevert("Funds already released");
        marketplace.claimFunds(orderId);
    }

    // ============ View Function Tests ============

    function test_IsSeller() public {
        assertFalse(marketplace.isSeller(seller1));

        vm.prank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10);

        assertTrue(marketplace.isSeller(seller1));
    }
}
