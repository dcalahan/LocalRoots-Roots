// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MultiFounderVesting.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployMultiFounderVesting
 * @notice Deploys and sets up the multi-beneficiary founder vesting contract
 *
 * Beneficiary allocations (10M ROOTS total = 1% of 1B supply):
 * - Doug Calahan:    85% = 8,500,000 ROOTS
 * - Jennifer Averill: 4% =   400,000 ROOTS
 * - Trey Averill:     2% =   200,000 ROOTS
 * - Carson Calahan:   2% =   200,000 ROOTS
 * - Claire Calahan:   2% =   200,000 ROOTS
 * - Doug Wait:        2% =   200,000 ROOTS
 * - Barb Wait:        2% =   200,000 ROOTS
 * - Allison Sall:     1% =   100,000 ROOTS
 *
 * Usage:
 * forge script script/DeployMultiFounderVesting.s.sol:DeployMultiFounderVesting \
 *   --rpc-url https://sepolia.base.org \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast
 */
contract DeployMultiFounderVesting is Script {
    // ROOTS Token on Base Sepolia
    address constant ROOTS_TOKEN = 0xffDAa58B1EB72c81ba8B728880b18A8E52409Ac7;

    // Total founder allocation: 10 million ROOTS
    uint256 constant TOTAL_FOUNDER_ALLOCATION = 10_000_000 * 10**18;

    // Individual allocations
    uint256 constant DOUG_CALAHAN_ALLOCATION   = 8_500_000 * 10**18;  // 85%
    uint256 constant JENNIFER_AVERILL_ALLOCATION = 400_000 * 10**18;  // 4%
    uint256 constant TREY_AVERILL_ALLOCATION     = 200_000 * 10**18;  // 2%
    uint256 constant CARSON_CALAHAN_ALLOCATION   = 200_000 * 10**18;  // 2%
    uint256 constant CLAIRE_CALAHAN_ALLOCATION   = 200_000 * 10**18;  // 2%
    uint256 constant DOUG_WAIT_ALLOCATION        = 200_000 * 10**18;  // 2%
    uint256 constant BARB_WAIT_ALLOCATION        = 200_000 * 10**18;  // 2%
    uint256 constant ALLISON_SALL_ALLOCATION     = 100_000 * 10**18;  // 1%

    function run() external {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get beneficiary addresses from environment
        // If not provided, use unique placeholder addresses (derived deterministically)
        // Doug Calahan (primary founder) defaults to deployer
        address dougCalahan = vm.envOr("DOUG_CALAHAN_ADDRESS", deployer);

        // Other beneficiaries - use unique placeholder addresses if not set
        // These are deterministic addresses for testing; provide real addresses for production
        address jenniferAverill = vm.envOr("JENNIFER_AVERILL_ADDRESS", vm.addr(uint256(keccak256("jennifer.averill"))));
        address treyAverill = vm.envOr("TREY_AVERILL_ADDRESS", vm.addr(uint256(keccak256("trey.averill"))));
        address carsonCalahan = vm.envOr("CARSON_CALAHAN_ADDRESS", vm.addr(uint256(keccak256("carson.calahan"))));
        address claireCalahan = vm.envOr("CLAIRE_CALAHAN_ADDRESS", vm.addr(uint256(keccak256("claire.calahan"))));
        address dougWait = vm.envOr("DOUG_WAIT_ADDRESS", vm.addr(uint256(keccak256("doug.wait"))));
        address barbWait = vm.envOr("BARB_WAIT_ADDRESS", vm.addr(uint256(keccak256("barb.wait"))));
        address allisonSall = vm.envOr("ALLISON_SALL_ADDRESS", vm.addr(uint256(keccak256("allison.sall"))));

        console.log("Deploying MultiFounderVesting...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy the vesting contract
        MultiFounderVesting vesting = new MultiFounderVesting(ROOTS_TOKEN);
        console.log("MultiFounderVesting deployed at:", address(vesting));

        // 2. Add beneficiaries
        address[] memory beneficiaries = new address[](8);
        uint256[] memory allocations = new uint256[](8);

        beneficiaries[0] = dougCalahan;
        allocations[0] = DOUG_CALAHAN_ALLOCATION;

        beneficiaries[1] = jenniferAverill;
        allocations[1] = JENNIFER_AVERILL_ALLOCATION;

        beneficiaries[2] = treyAverill;
        allocations[2] = TREY_AVERILL_ALLOCATION;

        beneficiaries[3] = carsonCalahan;
        allocations[3] = CARSON_CALAHAN_ALLOCATION;

        beneficiaries[4] = claireCalahan;
        allocations[4] = CLAIRE_CALAHAN_ALLOCATION;

        beneficiaries[5] = dougWait;
        allocations[5] = DOUG_WAIT_ALLOCATION;

        beneficiaries[6] = barbWait;
        allocations[6] = BARB_WAIT_ALLOCATION;

        beneficiaries[7] = allisonSall;
        allocations[7] = ALLISON_SALL_ALLOCATION;

        vesting.addBeneficiaries(beneficiaries, allocations);
        console.log("Added 8 beneficiaries");

        // 3. Transfer ROOTS tokens to vesting contract
        IERC20 roots = IERC20(ROOTS_TOKEN);
        uint256 balance = roots.balanceOf(deployer);
        console.log("Deployer ROOTS balance:", balance / 10**18);

        require(balance >= TOTAL_FOUNDER_ALLOCATION, "Insufficient ROOTS balance");

        roots.transfer(address(vesting), TOTAL_FOUNDER_ALLOCATION);
        console.log("Transferred", TOTAL_FOUNDER_ALLOCATION / 10**18, "ROOTS to vesting contract");

        // 4. Initialize the vesting
        vesting.initialize();
        console.log("Vesting initialized!");

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("MultiFounderVesting:", address(vesting));
        console.log("Total allocated:", TOTAL_FOUNDER_ALLOCATION / 10**18, "ROOTS");
        console.log("Vesting duration: 3 years");
        console.log("Cliff period: 6 months");
        console.log("\nBeneficiaries:");
        console.log("  Doug Calahan:", dougCalahan, "- 8,500,000 ROOTS (85%)");
        console.log("  Jennifer Averill:", jenniferAverill, "- 400,000 ROOTS (4%)");
        console.log("  Trey Averill:", treyAverill, "- 200,000 ROOTS (2%)");
        console.log("  Carson Calahan:", carsonCalahan, "- 200,000 ROOTS (2%)");
        console.log("  Claire Calahan:", claireCalahan, "- 200,000 ROOTS (2%)");
        console.log("  Doug Wait:", dougWait, "- 200,000 ROOTS (2%)");
        console.log("  Barb Wait:", barbWait, "- 200,000 ROOTS (2%)");
        console.log("  Allison Sall:", allisonSall, "- 100,000 ROOTS (1%)");
    }
}
