// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RootsToken.sol";

contract RootsTokenTest is Test {
    RootsToken public token;

    address public founderVesting = address(0x1);
    address public ambassadorRewards = address(0x2);
    address public liquidityPool = address(0x3);
    address public treasury = address(0x4);
    address public airdrop = address(0x5);

    address public alice = address(0x10);
    address public bob = address(0x11);

    function setUp() public {
        token = new RootsToken(
            founderVesting,
            ambassadorRewards,
            liquidityPool,
            treasury,
            airdrop
        );
    }

    // ============ Deployment Tests ============

    function test_TokenName() public view {
        assertEq(token.name(), "Local Roots");
    }

    function test_TokenSymbol() public view {
        assertEq(token.symbol(), "ROOTS");
    }

    function test_TotalSupply() public view {
        assertEq(token.totalSupply(), 100_000_000 * 10**18);
    }

    function test_Decimals() public view {
        assertEq(token.decimals(), 18);
    }

    // ============ Allocation Tests ============

    function test_FounderAllocation() public view {
        uint256 expected = (100_000_000 * 10**18 * 1000) / 10000; // 10%
        assertEq(token.balanceOf(founderVesting), expected);
        assertEq(token.balanceOf(founderVesting), 10_000_000 * 10**18);
    }

    function test_AmbassadorAllocation() public view {
        uint256 expected = (100_000_000 * 10**18 * 2500) / 10000; // 25%
        assertEq(token.balanceOf(ambassadorRewards), expected);
        assertEq(token.balanceOf(ambassadorRewards), 25_000_000 * 10**18);
    }

    function test_LiquidityAllocation() public view {
        uint256 expected = (100_000_000 * 10**18 * 1500) / 10000; // 15%
        assertEq(token.balanceOf(liquidityPool), expected);
        assertEq(token.balanceOf(liquidityPool), 15_000_000 * 10**18);
    }

    function test_TreasuryAllocation() public view {
        uint256 expected = (100_000_000 * 10**18 * 4000) / 10000; // 40%
        assertEq(token.balanceOf(treasury), expected);
        assertEq(token.balanceOf(treasury), 40_000_000 * 10**18);
    }

    function test_AirdropAllocation() public view {
        uint256 expected = (100_000_000 * 10**18 * 1000) / 10000; // 10%
        assertEq(token.balanceOf(airdrop), expected);
        assertEq(token.balanceOf(airdrop), 10_000_000 * 10**18);
    }

    function test_AllAllocationsSum() public view {
        uint256 totalAllocated = token.balanceOf(founderVesting) +
            token.balanceOf(ambassadorRewards) +
            token.balanceOf(liquidityPool) +
            token.balanceOf(treasury) +
            token.balanceOf(airdrop);

        assertEq(totalAllocated, token.totalSupply());
    }

    // ============ Immutable Address Tests ============

    function test_FounderVestingAddress() public view {
        assertEq(token.founderVesting(), founderVesting);
    }

    function test_AmbassadorRewardsAddress() public view {
        assertEq(token.ambassadorRewards(), ambassadorRewards);
    }

    function test_LiquidityPoolAddress() public view {
        assertEq(token.liquidityPool(), liquidityPool);
    }

    function test_TreasuryAddress() public view {
        assertEq(token.treasury(), treasury);
    }

    function test_AirdropAddress() public view {
        assertEq(token.airdrop(), airdrop);
    }

    // ============ Transfer Tests ============

    function test_Transfer() public {
        uint256 amount = 1000 * 10**18;

        vm.prank(treasury);
        token.transfer(alice, amount);

        assertEq(token.balanceOf(alice), amount);
    }

    function test_TransferFrom() public {
        uint256 amount = 1000 * 10**18;

        vm.prank(treasury);
        token.approve(alice, amount);

        vm.prank(alice);
        token.transferFrom(treasury, bob, amount);

        assertEq(token.balanceOf(bob), amount);
    }

    function test_RevertTransfer_InsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1000 * 10**18);
    }

    // ============ Burn Tests ============

    function test_Burn() public {
        uint256 burnAmount = 1000 * 10**18;
        uint256 initialSupply = token.totalSupply();
        uint256 initialBalance = token.balanceOf(treasury);

        vm.prank(treasury);
        token.burn(burnAmount);

        assertEq(token.totalSupply(), initialSupply - burnAmount);
        assertEq(token.balanceOf(treasury), initialBalance - burnAmount);
    }

    function test_BurnFrom() public {
        uint256 burnAmount = 1000 * 10**18;

        vm.prank(treasury);
        token.approve(alice, burnAmount);

        uint256 initialSupply = token.totalSupply();

        vm.prank(alice);
        token.burnFrom(treasury, burnAmount);

        assertEq(token.totalSupply(), initialSupply - burnAmount);
    }

    // ============ Constructor Validation Tests ============

    function test_RevertDeploy_ZeroFounderVesting() public {
        vm.expectRevert("Invalid founder vesting address");
        new RootsToken(
            address(0),
            ambassadorRewards,
            liquidityPool,
            treasury,
            airdrop
        );
    }

    function test_RevertDeploy_ZeroAmbassadorRewards() public {
        vm.expectRevert("Invalid ambassador rewards address");
        new RootsToken(
            founderVesting,
            address(0),
            liquidityPool,
            treasury,
            airdrop
        );
    }

    function test_RevertDeploy_ZeroLiquidityPool() public {
        vm.expectRevert("Invalid liquidity pool address");
        new RootsToken(
            founderVesting,
            ambassadorRewards,
            address(0),
            treasury,
            airdrop
        );
    }

    function test_RevertDeploy_ZeroTreasury() public {
        vm.expectRevert("Invalid treasury address");
        new RootsToken(
            founderVesting,
            ambassadorRewards,
            liquidityPool,
            address(0),
            airdrop
        );
    }

    function test_RevertDeploy_ZeroAirdrop() public {
        vm.expectRevert("Invalid airdrop address");
        new RootsToken(
            founderVesting,
            ambassadorRewards,
            liquidityPool,
            treasury,
            address(0)
        );
    }

    // ============ ERC20 Permit Tests ============

    function test_PermitDomainSeparator() public view {
        // Just verify it doesn't revert
        token.DOMAIN_SEPARATOR();
    }

    function test_Nonces() public view {
        assertEq(token.nonces(alice), 0);
    }
}
