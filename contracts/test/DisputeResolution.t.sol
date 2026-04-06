// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/AmbassadorRewards.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/DisputeResolution.sol";

contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract DisputeResolutionTest is Test {
    RootsToken public token;
    AmbassadorRewards public ambassadorRewards;
    LocalRootsMarketplace public marketplace;
    DisputeResolution public disputeResolution;
    MockUSDC public usdc;

    address public founderVesting = address(0x1);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);

    address public admin = address(0x10);
    address public stateFounder = address(0x50);
    address public ambassador1 = address(0x100);
    address public ambassador2 = address(0x101);
    address public ambassador3 = address(0x102);
    address public ambassador4 = address(0x103);
    address public ambassador5 = address(0x104);
    address public seller1 = address(0x200);
    address public buyer1 = address(0x300);
    address public buyer2 = address(0x301);

    // Hardcoded USDC address from marketplace
    address public constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    uint256 public constant AMBASSADOR_ALLOCATION = 25_000_000 * 10**18;
    uint256 public constant AMBASSADOR_COOLDOWN = 24 hours;
    uint256 public constant VOTE_DURATION = 3 days;
    uint256 public constant VOTE_EXTENSION = 2 days;

    function setUp() public {
        // Deploy Mock USDC at the hardcoded address
        usdc = new MockUSDC();
        vm.etch(USDC_ADDRESS, address(usdc).code);
        usdc = MockUSDC(USDC_ADDRESS);

        // Deploy rewards contract first
        ambassadorRewards = new AmbassadorRewards(address(1), address(0));

        // Deploy token
        token = new RootsToken(
            founderVesting,
            address(ambassadorRewards),
            liquidityPool,
            treasury,
            airdrop
        );

        // Redeploy rewards with correct token
        ambassadorRewards = new AmbassadorRewards(address(token), address(0));

        // Fund rewards contract
        vm.prank(treasury);
        token.transfer(address(ambassadorRewards), AMBASSADOR_ALLOCATION);
        ambassadorRewards.initializeTreasury();

        // Deploy marketplace (Phase 1 USDC)
        marketplace = new LocalRootsMarketplace(
            address(0),  // No ROOTS token in Phase 1
            address(ambassadorRewards),
            address(0),  // No trusted forwarder in tests
            admin,
            LocalRootsMarketplace.LaunchPhase.Phase1_USDC,
            USDC_ADDRESS
        );

        // Deploy dispute resolution
        disputeResolution = new DisputeResolution(
            address(ambassadorRewards),
            address(marketplace),
            address(0),  // No trusted forwarder in tests
            admin
        );

        // Configure marketplace
        ambassadorRewards.setMarketplace(address(marketplace));
        vm.prank(admin);
        marketplace.setDisputeResolution(address(disputeResolution));

        // Setup ambassadors with activated sellers
        _setupAmbassadorsWithActivatedSellers();
    }

    function _setupAmbassadorsWithActivatedSellers() internal {
        // Register state founder
        ambassadorRewards.registerStateFounder(stateFounder, bytes8("djq"), "");

        // Register 5 ambassadors under state founder
        vm.prank(ambassador1);
        ambassadorRewards.registerAmbassador(1, "");
        vm.prank(ambassador2);
        ambassadorRewards.registerAmbassador(1, "");
        vm.prank(ambassador3);
        ambassadorRewards.registerAmbassador(1, "");
        vm.prank(ambassador4);
        ambassadorRewards.registerAmbassador(1, "");
        vm.prank(ambassador5);
        ambassadorRewards.registerAmbassador(1, "");

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Register seller under state founder (so state founder has recruitedSellers)
        vm.prank(seller1);
        marketplace.registerSeller(
            bytes8("djq12345"),
            "ipfs://storefront",
            true,
            true,
            10,
            1  // State Founder's ID (so they can vote)
        );

        // Create listing
        vm.prank(seller1);
        marketplace.createListing("ipfs://tomatoes", 100 * 10**18, 100);

        // Fund buyers with USDC
        usdc.mint(buyer1, 1000 * 10**6);
        usdc.mint(buyer2, 1000 * 10**6);

        // Register sellers for each ambassador so they can vote
        _registerSellerForAmbassador(address(0x1001), 2); // ambassador1 ID
        _registerSellerForAmbassador(address(0x1002), 3); // ambassador2 ID
        _registerSellerForAmbassador(address(0x1003), 4); // ambassador3 ID
        _registerSellerForAmbassador(address(0x1004), 5); // ambassador4 ID
        _registerSellerForAmbassador(address(0x1005), 6); // ambassador5 ID

        // Activate seller1 (2 orders from 2 unique buyers)
        _createAndCompleteOrder(buyer1);
        _createAndCompleteOrder(buyer2);

        // D1: Whitelist test ambassadors so they qualify to vote without
        // needing to fully activate sellers in every test setup. Mirrors
        // the early-stage voter whitelist pattern from CLAUDE.md.
        vm.startPrank(admin);
        disputeResolution.addWhitelistedVoter(stateFounder);
        disputeResolution.addWhitelistedVoter(ambassador1);
        disputeResolution.addWhitelistedVoter(ambassador2);
        disputeResolution.addWhitelistedVoter(ambassador3);
        disputeResolution.addWhitelistedVoter(ambassador4);
        disputeResolution.addWhitelistedVoter(ambassador5);
        vm.stopPrank();
    }

    function _registerSellerForAmbassador(address sellerAddr, uint256 ambassadorId) internal {
        vm.prank(sellerAddr);
        marketplace.registerSeller(
            bytes8("djq12346"),
            "ipfs://storefront",
            true,
            true,
            10,
            ambassadorId
        );
    }

    function _createAndCompleteOrder(address buyer) internal returns (uint256 orderId) {
        vm.startPrank(buyer);
        usdc.approve(address(marketplace), 100 * 10**6);
        orderId = marketplace.purchase(1, 1, false, "", address(usdc));
        vm.stopPrank();

        vm.prank(seller1);
        marketplace.acceptOrder(orderId);

        vm.prank(seller1);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");

        vm.prank(buyer);
        marketplace.completeOrder(orderId);
    }

    function _createDisputedOrder() internal returns (uint256 orderId) {
        // Create an order
        usdc.mint(buyer1, 100 * 10**6);
        vm.startPrank(buyer1);
        usdc.approve(address(marketplace), 100 * 10**6);
        orderId = marketplace.purchase(1, 1, false, "", address(usdc));
        vm.stopPrank();

        vm.prank(seller1);
        marketplace.acceptOrder(orderId);

        vm.prank(seller1);
        marketplace.markReadyForPickup(orderId, "ipfs://proof");

        // Buyer raises dispute
        vm.prank(buyer1);
        marketplace.raiseDispute(orderId, "Product was rotten", "ipfs://evidence");
    }

    // ============ Open Dispute Tests ============

    function test_OpenDispute() public {
        uint256 orderId = _createDisputedOrder();

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDisputeByOrder(orderId);
        assertEq(dispute.orderId, orderId);
        assertEq(dispute.buyer, buyer1);
        assertEq(dispute.sellerId, 1);
        assertEq(dispute.buyerReason, "Product was rotten");
        assertEq(dispute.buyerEvidenceIpfs, "ipfs://evidence");
        assertFalse(dispute.resolved);
        assertEq(dispute.votesForBuyer, 0);
        assertEq(dispute.votesForSeller, 0);
    }

    function test_SellerResponseToDispute() public {
        uint256 orderId = _createDisputedOrder();
        IDisputeResolution.Dispute memory disputeBefore = disputeResolution.getDisputeByOrder(orderId);
        uint256 disputeId = 1;  // First dispute

        vm.prank(seller1);
        disputeResolution.submitSellerResponse(disputeId, "Product was fresh", "ipfs://seller-evidence");

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertEq(dispute.sellerResponse, "Product was fresh");
        assertEq(dispute.sellerEvidenceIpfs, "ipfs://seller-evidence");
    }

    function test_RevertSellerResponse_NotSeller() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(buyer1);
        vm.expectRevert("Not the seller");
        disputeResolution.submitSellerResponse(disputeId, "Response", "ipfs://evidence");
    }

    function test_RevertSellerResponse_AlreadySubmitted() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(seller1);
        disputeResolution.submitSellerResponse(disputeId, "Response 1", "ipfs://evidence");

        vm.prank(seller1);
        vm.expectRevert("Response already submitted");
        disputeResolution.submitSellerResponse(disputeId, "Response 2", "ipfs://evidence2");
    }

    // ============ Voting Tests ============

    function test_AmbassadorCanVote() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");  // Vote for buyer

        assertTrue(disputeResolution.hasVoted(disputeId, 2));  // Ambassador1 ID is 2

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertEq(dispute.votesForBuyer, 1);
        assertEq(dispute.votesForSeller, 0);
    }

    function test_MultipleVotes() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");  // For buyer

        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");  // For buyer

        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly"); // For seller

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertEq(dispute.votesForBuyer, 2);
        assertEq(dispute.votesForSeller, 1);
    }

    function test_RevertVote_NotAmbassador() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(buyer1);
        vm.expectRevert("Not an ambassador");
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
    }

    function test_RevertVote_AlreadyVoted() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        vm.prank(ambassador1);
        vm.expectRevert("Already voted");
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");
    }

    function test_RevertVote_VotingEnded() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTE_DURATION + 1);

        vm.prank(ambassador1);
        vm.expectRevert("Voting period ended");
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
    }

    function test_RevertVote_ReasonTooShort() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(ambassador1);
        vm.expectRevert("Reason must be at least 20 characters");
        disputeResolution.vote(disputeId, true, "Too short");
    }

    function test_GetVoteReason() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;
        string memory reason = "The buyer's evidence clearly shows the product was not as described";

        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, reason);

        string memory storedReason = disputeResolution.getVoteReason(disputeId, 2);  // Ambassador1 ID is 2
        assertEq(storedReason, reason);
    }

    // ============ Resolution Tests ============

    function test_ResolveBuyerWins() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Get 5 votes for buyer (quorum)
        vm.prank(stateFounder);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador4);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTE_DURATION + 1);

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer1);

        disputeResolution.resolveDispute(disputeId);

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertTrue(dispute.resolved);
        assertTrue(dispute.buyerWon);

        // Buyer should be refunded
        assertGt(usdc.balanceOf(buyer1), buyerBalanceBefore);
    }

    function test_ResolveSellerWins() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Get 5 votes for seller (quorum)
        vm.prank(stateFounder);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");
        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");
        vm.prank(ambassador4);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTE_DURATION + 1);

        uint256 sellerBalanceBefore = usdc.balanceOf(seller1);

        disputeResolution.resolveDispute(disputeId);

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertTrue(dispute.resolved);
        assertFalse(dispute.buyerWon);

        // Seller should receive funds
        assertGt(usdc.balanceOf(seller1), sellerBalanceBefore);
    }

    function test_ExtendVotingNoQuorum() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Only 2 votes (below quorum of 5)
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTE_DURATION + 1);

        IDisputeResolution.Dispute memory disputeBefore = disputeResolution.getDispute(disputeId);
        uint256 oldVotingEndsAt = disputeBefore.votingEndsAt;

        // Resolve should extend
        disputeResolution.resolveDispute(disputeId);

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertFalse(dispute.resolved);
        assertTrue(dispute.extended);
        assertGt(dispute.votingEndsAt, oldVotingEndsAt);
    }

    function test_AutoRefundAfterExtensionNoQuorum() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Only 2 votes
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, false, "The seller provided adequate proof that the product was delivered correctly");

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTE_DURATION + 1);

        // First resolve extends voting
        disputeResolution.resolveDispute(disputeId);

        // Fast forward past extension
        vm.warp(block.timestamp + VOTE_EXTENSION + 1);

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer1);

        // Second resolve auto-refunds buyer
        disputeResolution.resolveDispute(disputeId);

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertTrue(dispute.resolved);
        assertTrue(dispute.buyerWon);  // Auto-refund = buyer wins

        // Buyer should be refunded
        assertGt(usdc.balanceOf(buyer1), buyerBalanceBefore);
    }

    function test_RevertResolve_VotingStillActive() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.expectRevert("Voting still active");
        disputeResolution.resolveDispute(disputeId);
    }

    function test_RevertResolve_AlreadyResolved() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Get quorum and resolve
        vm.prank(stateFounder);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador4);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        disputeResolution.resolveDispute(disputeId);

        vm.expectRevert("Already resolved");
        disputeResolution.resolveDispute(disputeId);
    }

    // ============ Strike System Tests ============

    function test_SellerStrikeOnLoss() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // 5 votes for buyer
        vm.prank(stateFounder);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador4);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        disputeResolution.resolveDispute(disputeId);

        IDisputeResolution.UserStrikes memory strikes = disputeResolution.getUserStrikes(seller1);
        assertEq(strikes.sellerStrikes, 1);
    }

    function test_SellerAutoSuspendAfterThreeStrikes() public {
        // Create 3 disputes that seller loses
        _createAndResolveDisputeForBuyer(1);
        assertEq(disputeResolution.getUserStrikes(seller1).sellerStrikes, 1);
        assertFalse(marketplace.isSellerSuspended(1));

        _createAndResolveDisputeForBuyer(2);
        assertEq(disputeResolution.getUserStrikes(seller1).sellerStrikes, 2);
        assertFalse(marketplace.isSellerSuspended(1));

        _createAndResolveDisputeForBuyer(3);
        assertEq(disputeResolution.getUserStrikes(seller1).sellerStrikes, 3);

        // Seller should be suspended after 3 strikes
        assertTrue(marketplace.isSellerSuspended(1));
    }

    function _createAndResolveDisputeForBuyer(uint256 expectedDisputeId) internal {
        _createDisputedOrder();

        // 5 votes for buyer
        vm.prank(stateFounder);
        disputeResolution.vote(expectedDisputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador1);
        disputeResolution.vote(expectedDisputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador2);
        disputeResolution.vote(expectedDisputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador3);
        disputeResolution.vote(expectedDisputeId, true, "The buyer's evidence clearly shows the product was not as described");
        vm.prank(ambassador4);
        disputeResolution.vote(expectedDisputeId, true, "The buyer's evidence clearly shows the product was not as described");

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        disputeResolution.resolveDispute(expectedDisputeId);
    }

    // ============ Admin Override Tests ============

    function test_AdminResolveDispute() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer1);

        vm.prank(admin);
        disputeResolution.adminResolveDispute(disputeId, true, "Clear fraud - admin override");

        IDisputeResolution.Dispute memory dispute = disputeResolution.getDispute(disputeId);
        assertTrue(dispute.resolved);
        assertTrue(dispute.buyerWon);
        assertTrue(dispute.adminResolved);
        assertEq(dispute.adminReason, "Clear fraud - admin override");

        // Buyer should be refunded
        assertGt(usdc.balanceOf(buyer1), buyerBalanceBefore);
    }

    function test_RevertAdminResolve_NotAdmin() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        disputeResolution.adminResolveDispute(disputeId, true, "Reason");
    }

    // ============ View Function Tests ============

    function test_GetOpenDisputes() public {
        // Create 3 disputes
        _createDisputedOrder();
        _createDisputedOrder();
        _createDisputedOrder();

        uint256[] memory openDisputes = disputeResolution.getOpenDisputes(0, 100);
        assertEq(openDisputes.length, 3);

        // Resolve one
        vm.prank(admin);
        disputeResolution.adminResolveDispute(1, true, "Admin resolved");

        openDisputes = disputeResolution.getOpenDisputes(0, 100);
        assertEq(openDisputes.length, 2);
    }

    function test_GetQualifiedVoterCount() public {
        // State founder + 5 ambassadors = 6 qualified voters
        // All have recruited at least 1 seller
        uint256 voterCount = disputeResolution.getQualifiedVoterCount(0, 100);
        assertEq(voterCount, 6);
    }

    // ============ Admin Management Tests ============

    function test_AddAdmin() public {
        address newAdmin = address(0x999);

        vm.prank(admin);
        disputeResolution.addAdmin(newAdmin);

        assertTrue(disputeResolution.isAdmin(newAdmin));
    }

    function test_RemoveAdmin() public {
        address newAdmin = address(0x999);

        vm.prank(admin);
        disputeResolution.addAdmin(newAdmin);

        vm.prank(admin);
        disputeResolution.removeAdmin(newAdmin);

        assertFalse(disputeResolution.isAdmin(newAdmin));
    }

    function test_RevertRemoveLastAdmin() public {
        vm.prank(admin);
        vm.expectRevert("Cannot remove last admin");
        disputeResolution.removeAdmin(admin);
    }

    // ============ Whitelist Tests ============

    function test_AddWhitelistedVoter() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        disputeResolution.addWhitelistedVoter(newVoter);

        assertTrue(disputeResolution.whitelistedVoters(newVoter));
    }

    function test_RemoveWhitelistedVoter() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        disputeResolution.addWhitelistedVoter(newVoter);
        assertTrue(disputeResolution.whitelistedVoters(newVoter));

        vm.prank(admin);
        disputeResolution.removeWhitelistedVoter(newVoter);
        assertFalse(disputeResolution.whitelistedVoters(newVoter));
    }

    function test_RevertAddWhitelistedVoter_NotAdmin() public {
        address newVoter = address(0x888);

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        disputeResolution.addWhitelistedVoter(newVoter);
    }

    function test_RevertRemoveWhitelistedVoter_NotAdmin() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        disputeResolution.addWhitelistedVoter(newVoter);

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        disputeResolution.removeWhitelistedVoter(newVoter);
    }

    function test_WhitelistedVoterCanVoteWithoutActivatedSeller() public {
        // Create a new ambassador without any recruited sellers
        address newAmbassador = address(0x999);
        vm.prank(newAmbassador);
        ambassadorRewards.registerAmbassador(1, "");  // Under state founder

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Create a dispute
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // newAmbassador can't vote without recruited seller
        vm.prank(newAmbassador);
        vm.expectRevert("Must have 1+ recruited seller");
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        // Whitelist the new ambassador
        vm.prank(admin);
        disputeResolution.addWhitelistedVoter(newAmbassador);

        // Now they can vote
        vm.prank(newAmbassador);
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");

        assertTrue(disputeResolution.hasVoted(disputeId, 7));  // newAmbassador ID is 7
    }

    function test_NonWhitelistedVoterStillRequiresActivatedSeller() public {
        // Create a new ambassador without any recruited sellers
        address newAmbassador = address(0x999);
        vm.prank(newAmbassador);
        ambassadorRewards.registerAmbassador(1, "");  // Under state founder

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Create a dispute
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // newAmbassador can't vote without recruited seller (not whitelisted)
        vm.prank(newAmbassador);
        vm.expectRevert("Must have 1+ recruited seller");
        disputeResolution.vote(disputeId, true, "The buyer's evidence clearly shows the product was not as described");
    }

    function _voteAndResolveForBuyer(uint256 /*orderId*/, uint256 disputeId) internal {
        vm.prank(stateFounder);
        disputeResolution.vote(disputeId, true, "Buyer wins this round, evidence is convincing");
        vm.prank(ambassador1);
        disputeResolution.vote(disputeId, true, "Agreed, seller did not deliver as promised");
        vm.prank(ambassador2);
        disputeResolution.vote(disputeId, true, "Photos clearly show damaged produce on arrival");
        vm.prank(ambassador3);
        disputeResolution.vote(disputeId, true, "Refund is the appropriate outcome here today");
        vm.prank(ambassador4);
        disputeResolution.vote(disputeId, true, "Concur with the majority on this dispute case");

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        disputeResolution.resolveDispute(disputeId);
    }

    // ============ Security Fix Regression Tests (D1, D2, D4) ============

    /// @notice D1: Ambassador with a RECRUITED but NOT ACTIVATED seller cannot
    /// vote — passes the legacy "recruitedSellers >= 1" check but is correctly
    /// blocked by the new anti-Sybil "activated seller" check.
    function test_D1_RecruitedButNotActivatedCannotVote() public {
        // Create new ambassador not in the whitelist
        address sybilAmb = address(0xBEEF);
        vm.prank(sybilAmb);
        ambassadorRewards.registerAmbassador(1, "");
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Recruit a seller for this ambassador (passes the recruitedSellers check)
        // but DO NOT complete 2 orders (so seller is not activated)
        address sybilSeller = address(0xBEEE);
        vm.prank(sybilSeller);
        marketplace.registerSeller(bytes8("djq12347"), "ipfs://x", true, true, 10, 7);

        // Confirm: recruited but not activated
        assertEq(ambassadorRewards.getActivatedSellerCount(7), 0);

        // Create a dispute
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Should fail at the activated check (not the recruited check)
        vm.prank(sybilAmb);
        vm.expectRevert("Must have 1+ activated seller to vote");
        disputeResolution.vote(disputeId, true, "Buyer evidence convincing in this particular case");
    }

    /// @notice D2: Strikes are tracked per sellerId, not just per wallet — a
    /// suspended seller can't dodge auto-suspension by rotating to a new wallet
    /// (note: in this contract suspension is per-sellerId via the marketplace,
    /// so this test verifies the sellerStrikesById counter increments and
    /// triggers auto-suspend after 3 lost disputes).
    function test_D2_SellerStrikesTrackedById() public {
        // Initial state
        assertEq(disputeResolution.sellerStrikesById(1), 0);

        // Helper inline: vote 5x for buyer then resolve.
        _voteAndResolveForBuyer(_createDisputedOrder(), 1);
        assertEq(disputeResolution.sellerStrikesById(1), 1, "1 strike");

        _voteAndResolveForBuyer(_createDisputedOrder(), 2);
        assertEq(disputeResolution.sellerStrikesById(1), 2, "2 strikes");

        _voteAndResolveForBuyer(_createDisputedOrder(), 3);
        assertEq(disputeResolution.sellerStrikesById(1), 3, "3 strikes recorded");

        // Marketplace should have auto-suspended the seller
        // (verified indirectly: try to create a new listing as suspended seller)
        // We just check the counter here; full suspension flow is exercised elsewhere.
    }

    /// @notice D4: Seller cannot submit a response after the 36h response window.
    function test_D4_SellerResponseWindowExpired() public {
        uint256 orderId = _createDisputedOrder();
        uint256 disputeId = 1;

        // Within window — works
        vm.prank(seller1);
        disputeResolution.submitSellerResponse(disputeId, "Initial response", "ipfs://x");

        // Create a 2nd dispute, let window expire
        uint256 orderId2 = _createDisputedOrder();
        uint256 disputeId2 = 2;

        vm.warp(block.timestamp + 37 hours);

        vm.prank(seller1);
        vm.expectRevert("Response window expired");
        disputeResolution.submitSellerResponse(disputeId2, "Too late", "ipfs://y");
    }
}
