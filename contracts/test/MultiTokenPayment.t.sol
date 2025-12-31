// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "../src/MockERC20.sol";
import "../src/MockSwapRouter.sol";

contract MultiTokenPaymentTest is Test {
    RootsToken public rootsToken;
    LocalRootsMarketplace public marketplace;
    AmbassadorRewards public ambassadorRewardsContract;
    MockUSDC public usdc;
    MockUSDT public usdt;
    MockSwapRouter public swapRouter;

    address public founderVesting = address(0x1);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);
    address public admin = address(0x6);

    address public seller1 = address(0x100);
    address public buyer1 = address(0x200);

    bytes8 public geohash1 = bytes8("9q8yyk9");  // San Francisco area

    uint256 public constant INITIAL_ROOTS_BALANCE = 10_000 * 10**18;
    uint256 public constant INITIAL_STABLECOIN_BALANCE = 1000 * 10**6; // 1000 USDC/USDT
    uint256 public constant PRICE_PER_UNIT = 100 * 10**18; // 100 ROOTS per unit ($1 USD)
    uint256 public constant AMBASSADOR_ALLOCATION = 25_000_000 * 10**18;
    uint256 public constant SWAP_ROUTER_LIQUIDITY = 1_000_000 * 10**18; // 1M ROOTS for swaps

    function setUp() public {
        // Deploy ambassador rewards first
        ambassadorRewardsContract = new AmbassadorRewards(address(1), address(0));

        // Deploy ROOTS token
        rootsToken = new RootsToken(
            founderVesting,
            address(ambassadorRewardsContract),
            liquidityPool,
            treasury,
            airdrop
        );

        // Redeploy ambassador rewards with correct token
        ambassadorRewardsContract = new AmbassadorRewards(address(rootsToken), address(0));

        // Fund ambassador treasury
        vm.prank(treasury);
        rootsToken.transfer(address(ambassadorRewardsContract), AMBASSADOR_ALLOCATION);

        // Deploy mock stablecoins
        usdc = new MockUSDC();
        usdt = new MockUSDT();

        // Deploy swap router with ROOTS token
        swapRouter = new MockSwapRouter(address(rootsToken));

        // Add stablecoins to swap router
        swapRouter.addStablecoin(address(usdc));
        swapRouter.addStablecoin(address(usdt));

        // Fund swap router with ROOTS for swaps
        vm.prank(treasury);
        rootsToken.transfer(address(swapRouter), SWAP_ROUTER_LIQUIDITY);

        // Deploy marketplace
        marketplace = new LocalRootsMarketplace(
            address(rootsToken),
            address(ambassadorRewardsContract),
            address(0),
            admin
        );

        // Set marketplace in ambassador rewards
        ambassadorRewardsContract.setMarketplace(address(marketplace));

        // Configure marketplace for multi-token payments
        vm.startPrank(admin);
        marketplace.setSwapRouter(address(swapRouter));
        marketplace.addPaymentToken(address(usdc));
        marketplace.addPaymentToken(address(usdt));
        vm.stopPrank();

        // Fund test accounts
        vm.startPrank(treasury);
        rootsToken.transfer(seller1, INITIAL_ROOTS_BALANCE);
        rootsToken.transfer(buyer1, INITIAL_ROOTS_BALANCE);
        vm.stopPrank();

        // Mint stablecoins to buyer
        usdc.mint(buyer1, INITIAL_STABLECOIN_BALANCE);
        usdt.mint(buyer1, INITIAL_STABLECOIN_BALANCE);
    }

    // ============ Setup Helper ============

    function _createListingFixture() internal returns (uint256 listingId) {
        vm.startPrank(seller1);
        marketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);
        listingId = marketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();
    }

    // ============ Payment Token Configuration Tests ============

    function test_SwapRouterConfigured() public view {
        assertEq(marketplace.swapRouter(), address(swapRouter));
    }

    function test_PaymentTokensAccepted() public view {
        assertTrue(marketplace.acceptedPaymentTokens(address(usdc)));
        assertTrue(marketplace.acceptedPaymentTokens(address(usdt)));
        assertFalse(marketplace.acceptedPaymentTokens(address(rootsToken))); // ROOTS is native
    }

    function test_GetAcceptedPaymentTokens() public view {
        address[] memory tokens = marketplace.getAcceptedPaymentTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(usdc));
        assertEq(tokens[1], address(usdt));
    }

    function test_RemovePaymentToken() public {
        vm.prank(admin);
        marketplace.removePaymentToken(address(usdt));

        assertFalse(marketplace.acceptedPaymentTokens(address(usdt)));

        address[] memory tokens = marketplace.getAcceptedPaymentTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(usdc));
    }

    // ============ Stablecoin Price Conversion Tests ============

    function test_GetStablecoinPrice() public view {
        // 100 ROOTS = $1 USD
        // 100 ROOTS (100e18) should cost 1 USDC (1e6)
        uint256 rootsAmount = 100 * 10**18;
        uint256 stablecoinPrice = marketplace.getStablecoinPrice(rootsAmount);
        assertEq(stablecoinPrice, 1 * 10**6); // 1 USDC
    }

    function test_GetStablecoinPrice_LargerAmount() public view {
        // 1000 ROOTS = $10 USD
        uint256 rootsAmount = 1000 * 10**18;
        uint256 stablecoinPrice = marketplace.getStablecoinPrice(rootsAmount);
        assertEq(stablecoinPrice, 10 * 10**6); // 10 USDC
    }

    // ============ Purchase with USDC Tests ============

    function test_PurchaseWithUSDC() public {
        _createListingFixture();

        // Price is 100 ROOTS per unit = $1 USD = 1 USDC
        // Buying 5 units = 5 USDC
        uint256 quantity = 5;
        uint256 expectedUsdcCost = 5 * 10**6; // 5 USDC

        uint256 buyerUsdcBefore = usdc.balanceOf(buyer1);
        uint256 marketplaceRootsBefore = rootsToken.balanceOf(address(marketplace));

        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), expectedUsdcCost);
        uint256 orderId = marketplace.purchase(1, quantity, false, "", address(usdc));
        vm.stopPrank();

        assertEq(orderId, 1);
        // Buyer paid USDC
        assertEq(usdc.balanceOf(buyer1), buyerUsdcBefore - expectedUsdcCost);
        // Marketplace received ROOTS (from swap)
        uint256 expectedRoots = quantity * PRICE_PER_UNIT;
        assertEq(rootsToken.balanceOf(address(marketplace)), marketplaceRootsBefore + expectedRoots);
    }

    function test_PurchaseWithUSDT() public {
        _createListingFixture();

        uint256 quantity = 3;
        uint256 expectedUsdtCost = 3 * 10**6; // 3 USDT

        uint256 buyerUsdtBefore = usdt.balanceOf(buyer1);

        vm.startPrank(buyer1);
        usdt.approve(address(marketplace), expectedUsdtCost);
        uint256 orderId = marketplace.purchase(1, quantity, false, "", address(usdt));
        vm.stopPrank();

        assertEq(orderId, 1);
        assertEq(usdt.balanceOf(buyer1), buyerUsdtBefore - expectedUsdtCost);
    }

    function test_PurchaseWithROOTS_DirectPayment() public {
        _createListingFixture();

        uint256 quantity = 5;
        uint256 expectedRootsCost = quantity * PRICE_PER_UNIT;

        uint256 buyerRootsBefore = rootsToken.balanceOf(buyer1);

        vm.startPrank(buyer1);
        rootsToken.approve(address(marketplace), expectedRootsCost);
        uint256 orderId = marketplace.purchase(1, quantity, false, "", address(0)); // address(0) = ROOTS
        vm.stopPrank();

        assertEq(orderId, 1);
        assertEq(rootsToken.balanceOf(buyer1), buyerRootsBefore - expectedRootsCost);
    }

    function test_PurchaseWithROOTS_ExplicitToken() public {
        _createListingFixture();

        uint256 quantity = 5;
        uint256 expectedRootsCost = quantity * PRICE_PER_UNIT;

        uint256 buyerRootsBefore = rootsToken.balanceOf(buyer1);

        vm.startPrank(buyer1);
        rootsToken.approve(address(marketplace), expectedRootsCost);
        uint256 orderId = marketplace.purchase(1, quantity, false, "", address(rootsToken));
        vm.stopPrank();

        assertEq(orderId, 1);
        assertEq(rootsToken.balanceOf(buyer1), buyerRootsBefore - expectedRootsCost);
    }

    // ============ Escrow Works with Stablecoin Payments ============

    function test_EscrowHoldsROOTS_WhenPaidWithUSDC() public {
        _createListingFixture();

        uint256 quantity = 5;
        uint256 expectedRoots = quantity * PRICE_PER_UNIT;
        uint256 sellerRootsBefore = rootsToken.balanceOf(seller1);

        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), 5 * 10**6);
        uint256 orderId = marketplace.purchase(1, quantity, false, "", address(usdc));
        vm.stopPrank();

        // Seller has NOT received ROOTS yet (in escrow)
        assertEq(rootsToken.balanceOf(seller1), sellerRootsBefore);
        // Marketplace holds ROOTS in escrow
        assertEq(rootsToken.balanceOf(address(marketplace)), expectedRoots);

        // Complete the flow
        vm.startPrank(seller1);
        marketplace.acceptOrder(orderId);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");
        vm.stopPrank();

        // Wait for dispute window
        vm.warp(block.timestamp + 2 days + 1);

        // Seller claims funds
        vm.prank(seller1);
        marketplace.claimFunds(orderId);

        // Seller receives ROOTS (not USDC!)
        assertEq(rootsToken.balanceOf(seller1), sellerRootsBefore + expectedRoots);
    }

    // ============ Error Cases ============

    function test_RevertPurchase_TokenNotAccepted() public {
        _createListingFixture();

        // Create a random token that's not accepted
        MockUSDC randomToken = new MockUSDC();
        randomToken.mint(buyer1, 1000 * 10**6);

        vm.startPrank(buyer1);
        randomToken.approve(address(marketplace), 5 * 10**6);

        vm.expectRevert("Payment token not accepted");
        marketplace.purchase(1, 5, false, "", address(randomToken));
        vm.stopPrank();
    }

    function test_RevertPurchase_NoSwapRouterConfigured() public {
        // Deploy fresh marketplace without swap router
        LocalRootsMarketplace freshMarketplace = new LocalRootsMarketplace(
            address(rootsToken),
            address(ambassadorRewardsContract),
            address(0),
            admin
        );

        // Setup seller
        vm.startPrank(seller1);
        freshMarketplace.registerSeller(geohash1, "ipfs://store", true, true, 10, 0);
        freshMarketplace.createListing("ipfs://tomatoes", PRICE_PER_UNIT, 100);
        vm.stopPrank();

        // Add payment token without swap router
        vm.prank(admin);
        freshMarketplace.addPaymentToken(address(usdc));

        vm.startPrank(buyer1);
        usdc.approve(address(freshMarketplace), 5 * 10**6);

        vm.expectRevert("Swap router not configured");
        freshMarketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();
    }

    function test_RevertPurchase_InsufficientSwapRouterLiquidity() public {
        // Deploy swap router with insufficient ROOTS
        MockSwapRouter emptyRouter = new MockSwapRouter(address(rootsToken));
        emptyRouter.addStablecoin(address(usdc));
        // Note: Not funding the router with ROOTS

        // Reconfigure marketplace
        vm.startPrank(admin);
        marketplace.setSwapRouter(address(emptyRouter));
        vm.stopPrank();

        _createListingFixture();

        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), 5 * 10**6);

        vm.expectRevert("Insufficient ROOTS liquidity");
        marketplace.purchase(1, 5, false, "", address(usdc));
        vm.stopPrank();
    }

    // ============ Admin Functions ============

    function test_RevertAddPaymentToken_NotAdmin() public {
        MockUSDC newToken = new MockUSDC();

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        marketplace.addPaymentToken(address(newToken));
    }

    function test_RevertRemovePaymentToken_NotAdmin() public {
        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        marketplace.removePaymentToken(address(usdc));
    }

    function test_RevertSetSwapRouter_NotAdmin() public {
        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        marketplace.setSwapRouter(address(0x999));
    }

    // ============ Swap Router Tests ============

    function test_SwapRouter_GetQuote() public view {
        // 1 USDC (1e6) should return 100 ROOTS (100e18)
        uint256 quote = swapRouter.getQuote(1 * 10**6);
        assertEq(quote, 100 * 10**18);
    }

    function test_SwapRouter_DirectSwap() public {
        uint256 usdcAmount = 10 * 10**6; // 10 USDC
        uint256 expectedRoots = 1000 * 10**18; // 1000 ROOTS

        vm.startPrank(buyer1);
        usdc.approve(address(swapRouter), usdcAmount);

        uint256 rootsOut = swapRouter.swapStablecoinForRoots(
            address(usdc),
            usdcAmount,
            expectedRoots
        );
        vm.stopPrank();

        assertEq(rootsOut, expectedRoots);
        assertEq(rootsToken.balanceOf(buyer1), INITIAL_ROOTS_BALANCE + expectedRoots);
    }

    function test_RevertSwap_SlippageExceeded() public {
        uint256 usdcAmount = 10 * 10**6; // 10 USDC = 1000 ROOTS
        uint256 minRootsOut = 1100 * 10**18; // Expect more than we'd get

        vm.startPrank(buyer1);
        usdc.approve(address(swapRouter), usdcAmount);

        vm.expectRevert("Slippage exceeded");
        swapRouter.swapStablecoinForRoots(address(usdc), usdcAmount, minRootsOut);
        vm.stopPrank();
    }
}
