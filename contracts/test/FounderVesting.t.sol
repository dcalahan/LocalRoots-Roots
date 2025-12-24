// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";
import "../src/FounderVesting.sol";

contract FounderVestingTest is Test {
    RootsToken public token;
    FounderVesting public vesting;

    address public founder = address(0x100);
    address public ambassadorRewards = address(0x2);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);

    uint256 public constant CLIFF_DURATION = 180 days;
    uint256 public constant VESTING_DURATION = 1095 days; // 3 years
    uint256 public constant FOUNDER_ALLOCATION = 10_000_000 * 10**18;

    function setUp() public {
        // Deploy vesting contract first (predicting token address)
        vesting = new FounderVesting(address(0x999), founder); // temp token address

        // Deploy a new vesting with correct setup
        vesting = new FounderVesting(address(1), founder);

        // Deploy token with vesting address
        token = new RootsToken(
            address(vesting),
            ambassadorRewards,
            liquidityPool,
            treasury,
            airdrop
        );

        // Deploy proper vesting contract
        vesting = new FounderVesting(address(token), founder);

        // Transfer tokens to vesting contract
        vm.prank(treasury);
        token.transfer(address(vesting), FOUNDER_ALLOCATION);

        // Initialize allocation
        vesting.initializeAllocation();
    }

    // ============ Deployment Tests ============

    function test_TokenAddress() public view {
        assertEq(address(vesting.token()), address(token));
    }

    function test_Beneficiary() public view {
        assertEq(vesting.beneficiary(), founder);
    }

    function test_TotalAllocation() public view {
        assertEq(vesting.totalAllocation(), FOUNDER_ALLOCATION);
    }

    function test_InitialReleased() public view {
        assertEq(vesting.released(), 0);
    }

    // ============ Cliff Tests ============

    function test_NoVestingBeforeCliff() public view {
        assertEq(vesting.vestedAmount(), 0);
        assertEq(vesting.releasable(), 0);
    }

    function test_NoVestingAtHalfCliff() public {
        vm.warp(block.timestamp + CLIFF_DURATION / 2);

        assertEq(vesting.vestedAmount(), 0);
        assertEq(vesting.releasable(), 0);
    }

    function test_NoVestingJustBeforeCliff() public {
        vm.warp(block.timestamp + CLIFF_DURATION - 1);

        assertEq(vesting.vestedAmount(), 0);
        assertEq(vesting.releasable(), 0);
    }

    function test_VestingStartsAtCliff() public {
        vm.warp(block.timestamp + CLIFF_DURATION);

        uint256 vested = vesting.vestedAmount();
        assertGt(vested, 0);

        // At cliff (180 days into 1095 day vesting), should have ~16.4% vested
        uint256 expectedVested = (FOUNDER_ALLOCATION * CLIFF_DURATION) / VESTING_DURATION;
        assertEq(vested, expectedVested);
    }

    // ============ Linear Vesting Tests ============

    function test_LinearVestingAtOneYear() public {
        vm.warp(block.timestamp + 365 days);

        uint256 vested = vesting.vestedAmount();
        uint256 expectedVested = (FOUNDER_ALLOCATION * 365 days) / VESTING_DURATION;

        assertEq(vested, expectedVested);
    }

    function test_LinearVestingAtTwoYears() public {
        vm.warp(block.timestamp + 730 days);

        uint256 vested = vesting.vestedAmount();
        uint256 expectedVested = (FOUNDER_ALLOCATION * 730 days) / VESTING_DURATION;

        assertEq(vested, expectedVested);
    }

    function test_FullVestingAtThreeYears() public {
        vm.warp(block.timestamp + VESTING_DURATION);

        assertEq(vesting.vestedAmount(), FOUNDER_ALLOCATION);
        assertEq(vesting.releasable(), FOUNDER_ALLOCATION);
    }

    function test_NoExtraVestingAfterThreeYears() public {
        vm.warp(block.timestamp + VESTING_DURATION + 365 days);

        assertEq(vesting.vestedAmount(), FOUNDER_ALLOCATION);
    }

    // ============ Release Tests ============

    function test_ReleaseAfterCliff() public {
        vm.warp(block.timestamp + CLIFF_DURATION);

        uint256 releasable = vesting.releasable();
        uint256 founderBalanceBefore = token.balanceOf(founder);

        vesting.release();

        assertEq(token.balanceOf(founder), founderBalanceBefore + releasable);
        assertEq(vesting.released(), releasable);
        assertEq(vesting.releasable(), 0);
    }

    function test_MultipleReleases() public {
        uint256 startTs = block.timestamp;

        // First release at cliff (180 days)
        vm.warp(startTs + CLIFF_DURATION);
        uint256 firstRelease = vesting.releasable();
        vesting.release();

        // Second release 6 months later (360 days total)
        vm.warp(startTs + CLIFF_DURATION + 180 days);
        uint256 secondRelease = vesting.releasable();
        assertGt(secondRelease, 0);
        vesting.release();

        assertEq(vesting.released(), firstRelease + secondRelease);
        assertEq(token.balanceOf(founder), firstRelease + secondRelease);
    }

    function test_FullRelease() public {
        vm.warp(block.timestamp + VESTING_DURATION);

        vesting.release();

        assertEq(token.balanceOf(founder), FOUNDER_ALLOCATION);
        assertEq(vesting.released(), FOUNDER_ALLOCATION);
        assertEq(vesting.releasable(), 0);
    }

    function test_RevertRelease_NothingToRelease() public {
        // Before cliff
        vm.expectRevert("No tokens to release");
        vesting.release();
    }

    function test_RevertRelease_AlreadyReleased() public {
        vm.warp(block.timestamp + VESTING_DURATION);
        vesting.release();

        vm.expectRevert("No tokens to release");
        vesting.release();
    }

    // ============ Vesting Info Tests ============

    function test_VestingInfo() public {
        vm.warp(block.timestamp + 365 days);
        vesting.release();

        (
            uint256 totalAlloc,
            uint256 released,
            uint256 releasable,
            uint256 vested,
            uint256 cliffEnd,
            uint256 vestingEnd
        ) = vesting.vestingInfo();

        assertEq(totalAlloc, FOUNDER_ALLOCATION);
        assertGt(released, 0);
        assertGe(releasable, 0);
        assertGe(vested, released); // vested >= released (equal right after release)
        assertEq(cliffEnd, vesting.startTime() + CLIFF_DURATION);
        assertEq(vestingEnd, vesting.startTime() + VESTING_DURATION);
    }

    // ============ Constructor Validation Tests ============

    function test_RevertDeploy_ZeroToken() public {
        vm.expectRevert("Invalid token address");
        new FounderVesting(address(0), founder);
    }

    function test_RevertDeploy_ZeroBeneficiary() public {
        vm.expectRevert("Invalid beneficiary address");
        new FounderVesting(address(token), address(0));
    }

    // ============ Initialization Tests ============

    function test_RevertInitialize_AlreadyInitialized() public {
        vm.expectRevert("Already initialized");
        vesting.initializeAllocation();
    }

    function test_RevertInitialize_NoTokens() public {
        FounderVesting newVesting = new FounderVesting(address(token), founder);

        vm.expectRevert("No tokens to vest");
        newVesting.initializeAllocation();
    }

    // ============ Fuzz Tests ============

    function testFuzz_VestingLinear(uint256 timeElapsed) public {
        // Bound to reasonable range (0 to 5 years)
        timeElapsed = bound(timeElapsed, 0, 5 * 365 days);

        vm.warp(block.timestamp + timeElapsed);

        uint256 vested = vesting.vestedAmount();

        if (timeElapsed < CLIFF_DURATION) {
            assertEq(vested, 0);
        } else if (timeElapsed >= VESTING_DURATION) {
            assertEq(vested, FOUNDER_ALLOCATION);
        } else {
            uint256 expectedVested = (FOUNDER_ALLOCATION * timeElapsed) / VESTING_DURATION;
            assertEq(vested, expectedVested);
        }
    }
}
