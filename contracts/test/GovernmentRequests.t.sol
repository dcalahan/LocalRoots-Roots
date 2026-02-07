// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/AmbassadorRewards.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/GovernmentRequests.sol";

contract MockUSDCForGov {
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

contract GovernmentRequestsTest is Test {
    RootsToken public token;
    AmbassadorRewards public ambassadorRewards;
    LocalRootsMarketplace public marketplace;
    GovernmentRequests public governmentRequests;
    MockUSDCForGov public usdc;

    address public founderVesting = address(0x1);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);

    address public admin = address(0x10);
    address public govAgent = address(0x20);
    address public stateFounder = address(0x50);
    address public ambassador1 = address(0x100);
    address public ambassador2 = address(0x101);
    address public ambassador3 = address(0x102);
    address public ambassador4 = address(0x103);
    address public ambassador5 = address(0x104);
    address public ambassador6 = address(0x105);
    address public ambassador7 = address(0x106);
    address public ambassador8 = address(0x107);
    address public ambassador9 = address(0x108);
    address public ambassador10 = address(0x109);
    address public seller1 = address(0x200);
    address public buyer1 = address(0x300);
    address public buyer2 = address(0x301);

    // Hardcoded USDC address from marketplace
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint256 public constant AMBASSADOR_ALLOCATION = 25_000_000 * 10**18;
    uint256 public constant AMBASSADOR_COOLDOWN = 24 hours;
    uint256 public constant VOTE_DURATION = 5 days;
    uint256 public constant MIN_VOTES_REQUIRED = 10;
    uint256 public constant REQUEST_COOLDOWN = 30 days;

    function setUp() public {
        // Deploy Mock USDC at the hardcoded address
        usdc = new MockUSDCForGov();
        vm.etch(USDC_ADDRESS, address(usdc).code);
        usdc = MockUSDCForGov(USDC_ADDRESS);

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
            address(0),
            address(ambassadorRewards),
            address(0),
            admin,
            LocalRootsMarketplace.LaunchPhase.Phase1_USDC
        );

        // Deploy government requests
        governmentRequests = new GovernmentRequests(
            address(ambassadorRewards),
            address(0),
            admin
        );

        // Configure marketplace
        ambassadorRewards.setMarketplace(address(marketplace));

        // Setup 10+ ambassadors with recruited sellers so they can vote
        _setupAmbassadorsWithRecruitedSellers();
    }

    function _setupAmbassadorsWithRecruitedSellers() internal {
        // Register state founder
        ambassadorRewards.registerStateFounder(stateFounder, bytes8("djq"), "");

        // Register 10 ambassadors under state founder
        address[10] memory ambassadors = [
            ambassador1, ambassador2, ambassador3, ambassador4, ambassador5,
            ambassador6, ambassador7, ambassador8, ambassador9, ambassador10
        ];

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(ambassadors[i]);
            ambassadorRewards.registerAmbassador(1, "");
        }

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Register seller under state founder
        vm.prank(seller1);
        marketplace.registerSeller(
            bytes8("djq12345"),
            "ipfs://storefront",
            true,
            true,
            10,
            1  // State Founder's ID
        );

        // Register a seller for each ambassador so they can vote
        for (uint256 i = 0; i < 10; i++) {
            address sellerAddr = address(uint160(0x2001 + i));
            vm.prank(sellerAddr);
            marketplace.registerSeller(
                bytes8("djq12346"),
                "ipfs://storefront",
                true,
                true,
                10,
                i + 2  // Ambassador IDs start at 2
            );
        }
    }

    // ============ Submit Request Tests ============

    function test_SubmitRequest() public {
        vm.prank(govAgent);
        uint256 requestId = governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Investigating lettuce contamination outbreak affecting 50+ people in region. Need transaction records for affected produce.",
            "ipfs://credentials"
        );

        assertEq(requestId, 1);

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertEq(request.requester, govAgent);
        assertEq(request.agencyName, "FDA");
        assertEq(request.agencyEmail, "inspector@fda.gov");
        assertEq(request.jurisdiction, "Federal");
        assertEq(request.requestType, "food_safety");
        assertFalse(request.resolved);
        assertFalse(request.approved);
    }

    function test_RevertSubmit_JustificationTooShort() public {
        vm.prank(govAgent);
        vm.expectRevert("Justification too short");
        governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Too short",
            "ipfs://credentials"
        );
    }

    function test_RevertSubmit_AgencyCooldown() public {
        vm.prank(govAgent);
        governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Investigating lettuce contamination outbreak affecting 50+ people in region. Need transaction records for affected produce.",
            "ipfs://credentials"
        );

        // Try to submit another request from same agency
        vm.prank(govAgent);
        vm.expectRevert("Agency cooldown not expired");
        governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Another request that should fail because of cooldown period on same agency name.",
            "ipfs://credentials2"
        );

        // After cooldown, should work
        vm.warp(block.timestamp + REQUEST_COOLDOWN + 1);

        vm.prank(govAgent);
        uint256 requestId = governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Now this should work because the cooldown period has expired for the agency.",
            "ipfs://credentials3"
        );

        assertEq(requestId, 2);
    }

    // ============ Voting Tests ============

    function test_AmbassadorCanVote() public {
        _createRequest();

        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(1, true);

        assertTrue(governmentRequests.hasVotedOnRequest(1, 2));  // Ambassador1 ID is 2

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertEq(request.votesApprove, 1);
        assertEq(request.votesDeny, 0);
    }

    function test_MultipleVotes() public {
        _createRequest();

        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(1, true);  // Approve

        vm.prank(ambassador2);
        governmentRequests.voteOnRequest(1, true);  // Approve

        vm.prank(ambassador3);
        governmentRequests.voteOnRequest(1, false); // Deny

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertEq(request.votesApprove, 2);
        assertEq(request.votesDeny, 1);
    }

    function test_RevertVote_NotAmbassador() public {
        _createRequest();

        vm.prank(buyer1);
        vm.expectRevert("Not an ambassador");
        governmentRequests.voteOnRequest(1, true);
    }

    function test_RevertVote_AlreadyVoted() public {
        _createRequest();

        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(1, true);

        vm.prank(ambassador1);
        vm.expectRevert("Already voted");
        governmentRequests.voteOnRequest(1, false);
    }

    function test_RevertVote_VotingEnded() public {
        _createRequest();

        vm.warp(block.timestamp + VOTE_DURATION + 1);

        vm.prank(ambassador1);
        vm.expectRevert("Voting period ended");
        governmentRequests.voteOnRequest(1, true);
    }

    // ============ Resolution Tests ============

    function test_ResolveRequestApproved() public {
        _createRequest();

        // Get 10 approve votes (quorum)
        _voteApproveFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);

        governmentRequests.resolveRequest(1);

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertTrue(request.resolved);
        assertTrue(request.approved);
    }

    function test_ResolveRequestDenied() public {
        _createRequest();

        // Get 10 deny votes (quorum)
        _voteDenyFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);

        governmentRequests.resolveRequest(1);

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertTrue(request.resolved);
        assertFalse(request.approved);
    }

    function test_ResolveRequestNoQuorum() public {
        _createRequest();

        // Only 5 votes (below quorum of 10)
        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(1, true);
        vm.prank(ambassador2);
        governmentRequests.voteOnRequest(1, true);
        vm.prank(ambassador3);
        governmentRequests.voteOnRequest(1, true);
        vm.prank(ambassador4);
        governmentRequests.voteOnRequest(1, true);
        vm.prank(ambassador5);
        governmentRequests.voteOnRequest(1, true);

        vm.warp(block.timestamp + VOTE_DURATION + 1);

        governmentRequests.resolveRequest(1);

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertTrue(request.resolved);
        assertFalse(request.approved);  // No quorum = not approved
    }

    function test_RevertResolve_VotingStillActive() public {
        _createRequest();

        vm.expectRevert("Voting still active");
        governmentRequests.resolveRequest(1);
    }

    function test_RevertResolve_AlreadyResolved() public {
        _createRequest();
        _voteApproveFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        governmentRequests.resolveRequest(1);

        vm.expectRevert("Already resolved");
        governmentRequests.resolveRequest(1);
    }

    // ============ Admin Override Tests ============

    function test_AdminResolveRequest() public {
        _createRequest();

        vm.prank(admin);
        governmentRequests.adminResolveRequest(1, true, "Urgent food safety matter");

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertTrue(request.resolved);
        assertTrue(request.approved);
        assertTrue(request.adminResolved);
        assertEq(request.adminReason, "Urgent food safety matter");
    }

    function test_RevertAdminResolve_NotAdmin() public {
        _createRequest();

        vm.prank(govAgent);
        vm.expectRevert("Not an admin");
        governmentRequests.adminResolveRequest(1, true, "Reason");
    }

    // ============ Data Export Tests ============

    function test_UploadDataExport() public {
        _createRequest();
        _voteApproveFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        governmentRequests.resolveRequest(1);

        vm.prank(admin);
        governmentRequests.uploadDataExport(1, "ipfs://data-export");

        GovernmentRequests.DataRequest memory request = governmentRequests.getRequest(1);
        assertEq(request.dataExportIpfs, "ipfs://data-export");
    }

    function test_RevertUploadExport_NotApproved() public {
        _createRequest();
        _voteDenyFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        governmentRequests.resolveRequest(1);

        vm.prank(admin);
        vm.expectRevert("Request not approved");
        governmentRequests.uploadDataExport(1, "ipfs://data-export");
    }

    function test_RevertUploadExport_NotResolved() public {
        _createRequest();

        vm.prank(admin);
        vm.expectRevert("Request not resolved");
        governmentRequests.uploadDataExport(1, "ipfs://data-export");
    }

    function test_RevertUploadExport_AlreadyUploaded() public {
        _createRequest();
        _voteApproveFromAllAmbassadors(1);

        vm.warp(block.timestamp + VOTE_DURATION + 1);
        governmentRequests.resolveRequest(1);

        vm.prank(admin);
        governmentRequests.uploadDataExport(1, "ipfs://data-export");

        vm.prank(admin);
        vm.expectRevert("Export already uploaded");
        governmentRequests.uploadDataExport(1, "ipfs://data-export-2");
    }

    // ============ View Function Tests ============

    function test_GetActiveRequests() public {
        _createRequest();
        _createRequestWithDifferentAgency("CDC");
        _createRequestWithDifferentAgency("State Health Dept");

        uint256[] memory activeRequests = governmentRequests.getActiveRequests();
        assertEq(activeRequests.length, 3);

        // Resolve one
        vm.prank(admin);
        governmentRequests.adminResolveRequest(1, true, "Admin resolved");

        activeRequests = governmentRequests.getActiveRequests();
        assertEq(activeRequests.length, 2);
    }

    function test_GetAllRequests() public {
        _createRequest();
        _createRequestWithDifferentAgency("CDC");

        uint256[] memory allRequests = governmentRequests.getAllRequests();
        assertEq(allRequests.length, 2);
    }

    function test_GetQualifiedVoterCount() public view {
        // State founder + 10 ambassadors = 11 qualified voters
        uint256 voterCount = governmentRequests.getQualifiedVoterCount();
        assertEq(voterCount, 11);
    }

    // ============ Admin Management Tests ============

    function test_AddAdmin() public {
        address newAdmin = address(0x999);

        vm.prank(admin);
        governmentRequests.addAdmin(newAdmin);

        assertTrue(governmentRequests.isAdmin(newAdmin));
    }

    function test_RemoveAdmin() public {
        address newAdmin = address(0x999);

        vm.prank(admin);
        governmentRequests.addAdmin(newAdmin);

        vm.prank(admin);
        governmentRequests.removeAdmin(newAdmin);

        assertFalse(governmentRequests.isAdmin(newAdmin));
    }

    function test_RevertRemoveLastAdmin() public {
        vm.prank(admin);
        vm.expectRevert("Cannot remove last admin");
        governmentRequests.removeAdmin(admin);
    }

    // ============ Helper Functions ============

    function _createRequest() internal returns (uint256) {
        vm.prank(govAgent);
        return governmentRequests.submitRequest(
            "FDA",
            "inspector@fda.gov",
            "Federal",
            "food_safety",
            "Investigating lettuce contamination outbreak affecting 50+ people in region. Need transaction records for affected produce.",
            "ipfs://credentials"
        );
    }

    function _createRequestWithDifferentAgency(string memory agencyName) internal returns (uint256) {
        vm.prank(govAgent);
        return governmentRequests.submitRequest(
            agencyName,
            "inspector@gov.gov",
            "Federal",
            "food_safety",
            "Investigating food contamination outbreak. Need transaction records for affected produce and sellers.",
            "ipfs://credentials"
        );
    }

    function _voteApproveFromAllAmbassadors(uint256 requestId) internal {
        vm.prank(stateFounder);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador2);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador3);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador4);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador5);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador6);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador7);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador8);
        governmentRequests.voteOnRequest(requestId, true);
        vm.prank(ambassador9);
        governmentRequests.voteOnRequest(requestId, true);
    }

    function _voteDenyFromAllAmbassadors(uint256 requestId) internal {
        vm.prank(stateFounder);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador1);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador2);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador3);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador4);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador5);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador6);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador7);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador8);
        governmentRequests.voteOnRequest(requestId, false);
        vm.prank(ambassador9);
        governmentRequests.voteOnRequest(requestId, false);
    }

    // ============ Whitelist Tests ============

    function test_AddWhitelistedVoter() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        governmentRequests.addWhitelistedVoter(newVoter);

        assertTrue(governmentRequests.whitelistedVoters(newVoter));
    }

    function test_RemoveWhitelistedVoter() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        governmentRequests.addWhitelistedVoter(newVoter);
        assertTrue(governmentRequests.whitelistedVoters(newVoter));

        vm.prank(admin);
        governmentRequests.removeWhitelistedVoter(newVoter);
        assertFalse(governmentRequests.whitelistedVoters(newVoter));
    }

    function test_RevertAddWhitelistedVoter_NotAdmin() public {
        address newVoter = address(0x888);

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        governmentRequests.addWhitelistedVoter(newVoter);
    }

    function test_RevertRemoveWhitelistedVoter_NotAdmin() public {
        address newVoter = address(0x888);

        vm.prank(admin);
        governmentRequests.addWhitelistedVoter(newVoter);

        vm.prank(buyer1);
        vm.expectRevert("Not an admin");
        governmentRequests.removeWhitelistedVoter(newVoter);
    }

    function test_WhitelistedVoterCanVoteWithoutRecruitedSeller() public {
        // Create a new ambassador without any recruited sellers
        address newAmbassador = address(0x999);
        vm.prank(newAmbassador);
        ambassadorRewards.registerAmbassador(1, "");  // Under state founder

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Create a request
        _createRequest();

        // newAmbassador can't vote without recruited seller
        vm.prank(newAmbassador);
        vm.expectRevert("Must have 1+ recruited seller");
        governmentRequests.voteOnRequest(1, true);

        // Whitelist the new ambassador
        vm.prank(admin);
        governmentRequests.addWhitelistedVoter(newAmbassador);

        // Now they can vote
        vm.prank(newAmbassador);
        governmentRequests.voteOnRequest(1, true);

        assertTrue(governmentRequests.hasVotedOnRequest(1, 12));  // newAmbassador ID is 12 (after 11 existing)
    }

    function test_NonWhitelistedVoterStillRequiresRecruitedSeller() public {
        // Create a new ambassador without any recruited sellers
        address newAmbassador = address(0x999);
        vm.prank(newAmbassador);
        ambassadorRewards.registerAmbassador(1, "");  // Under state founder

        // Wait for cooldown
        vm.warp(block.timestamp + AMBASSADOR_COOLDOWN);

        // Create a request
        _createRequest();

        // newAmbassador can't vote without recruited seller (not whitelisted)
        vm.prank(newAmbassador);
        vm.expectRevert("Must have 1+ recruited seller");
        governmentRequests.voteOnRequest(1, true);
    }
}
