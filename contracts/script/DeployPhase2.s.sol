// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ROOTSToken.sol";
import "../src/SeedsAirdrop.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";

/**
 * @title DeployPhase2
 * @notice Deployment script for Phase 2 transition ($ROOTS token launch)
 * @dev Phase 2 characteristics:
 *      - $ROOTS token is the primary payment method
 *      - Seeds are converted to $ROOTS via Merkle-based airdrop
 *      - Ambassador rewards are distributed as $ROOTS with 7-day vesting
 *      - One-way transition - cannot revert to Phase 1
 *
 * Pre-requisites:
 *   1. Run GenerateMerkleTree.ts to create merkle-root.txt and proofs.json
 *   2. Have ROOTS token deployed and addresses for all treasuries
 *   3. Ensure all pending Phase 1 operations are handled
 *
 * Usage:
 *   # Deploy SeedsAirdrop only (if ROOTS already deployed)
 *   forge script script/DeployPhase2.s.sol:DeployAirdrop \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 *   # Execute phase transition (after airdrop is deployed and funded)
 *   forge script script/DeployPhase2.s.sol:ExecuteTransition \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */

/**
 * @title DeployAirdrop
 * @notice Deploy the SeedsAirdrop contract for Phase 2
 */
contract DeployAirdrop is Script {
    function run() external {
        address deployer = vm.envAddress("FOUNDER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address rootsToken = vm.envAddress("ROOTS_TOKEN_ADDRESS");

        console.log("=== Deploy SeedsAirdrop for Phase 2 ===");
        console.log("Deployer:", deployer);
        console.log("ROOTS Token:", rootsToken);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SeedsAirdrop with 365-day claim window
        SeedsAirdrop airdrop = new SeedsAirdrop(
            rootsToken,
            deployer,  // Admin
            365        // 365 days claim period
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== SeedsAirdrop Deployed ===");
        console.log("SeedsAirdrop address:", address(airdrop));
        console.log("Claim deadline:", airdrop.claimDeadline());
        console.log("");
        console.log("Next steps:");
        console.log("  1. Transfer 100M ROOTS to SeedsAirdrop contract");
        console.log("  2. Call setMerkleRoot() with root from merkle-root.txt");
        console.log("  3. Run ExecuteTransition script");
    }
}

/**
 * @title SetMerkleRoot
 * @notice Set the Merkle root on the SeedsAirdrop contract
 */
contract SetMerkleRoot is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address airdropAddress = vm.envAddress("SEEDS_AIRDROP_ADDRESS");
        bytes32 merkleRoot = vm.envBytes32("MERKLE_ROOT");

        console.log("=== Set Merkle Root ===");
        console.log("SeedsAirdrop:", airdropAddress);
        console.log("Merkle Root:", vm.toString(merkleRoot));

        vm.startBroadcast(deployerPrivateKey);

        SeedsAirdrop airdrop = SeedsAirdrop(airdropAddress);
        airdrop.setMerkleRoot(merkleRoot);

        vm.stopBroadcast();

        console.log("");
        console.log("Merkle root set successfully!");
        console.log("Airdrop claims are now open.");
    }
}

/**
 * @title ExecuteTransition
 * @notice Execute the Phase 1 → Phase 2 transition
 * @dev This is a ONE-WAY operation and cannot be reversed!
 */
contract ExecuteTransition is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address rootsToken = vm.envAddress("ROOTS_TOKEN_ADDRESS");
        address marketplaceAddress = vm.envAddress("MARKETPLACE_ADDRESS");
        address ambassadorAddress = vm.envAddress("AMBASSADOR_REWARDS_ADDRESS");

        console.log("=== Phase 2 Transition ===");
        console.log("WARNING: This is a ONE-WAY transition!");
        console.log("");
        console.log("ROOTS Token:", rootsToken);
        console.log("Marketplace:", marketplaceAddress);
        console.log("AmbassadorRewards:", ambassadorAddress);

        LocalRootsMarketplace marketplace = LocalRootsMarketplace(marketplaceAddress);
        AmbassadorRewards ambassador = AmbassadorRewards(ambassadorAddress);

        // Verify current state
        require(
            marketplace.currentPhase() == LocalRootsMarketplace.LaunchPhase.Phase1_USDC,
            "Marketplace not in Phase 1"
        );
        require(
            ambassador.currentPhase() == AmbassadorRewards.LaunchPhase.Phase1_USDC,
            "AmbassadorRewards not in Phase 1"
        );

        console.log("");
        console.log("Current state verified: Both contracts in Phase 1");
        console.log("Executing transition...");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Transition Marketplace
        marketplace.transitionToPhase2(rootsToken);
        console.log("  [1/2] Marketplace transitioned to Phase 2");

        // Step 2: Transition AmbassadorRewards
        ambassador.transitionToPhase2();
        console.log("  [2/2] AmbassadorRewards transitioned to Phase 2");

        vm.stopBroadcast();

        // Verify final state
        require(
            marketplace.currentPhase() == LocalRootsMarketplace.LaunchPhase.Phase2_ROOTS,
            "Marketplace transition failed"
        );
        require(
            ambassador.currentPhase() == AmbassadorRewards.LaunchPhase.Phase2_ROOTS,
            "AmbassadorRewards transition failed"
        );
        require(
            marketplace.phaseTransitionLocked(),
            "Marketplace transition lock failed"
        );

        console.log("");
        console.log("=== Phase 2 Transition Complete ===");
        console.log("");
        console.log("Verified:");
        console.log("  - Marketplace phase: Phase2_ROOTS");
        console.log("  - AmbassadorRewards phase: Phase2_ROOTS");
        console.log("  - Transition locked: true (irreversible)");
        console.log("");
        console.log("Phase 2 is now ACTIVE:");
        console.log("  - Payments: ROOTS tokens (or stablecoins swapped to ROOTS)");
        console.log("  - Seller rewards: Direct ROOTS tokens");
        console.log("  - Ambassador rewards: ROOTS with 7-day vesting");
        console.log("  - Seeds airdrop: Users can claim at /claim");
    }
}

/**
 * @title FundAirdrop
 * @notice Transfer ROOTS tokens to the SeedsAirdrop contract
 */
contract FundAirdrop is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address rootsTokenAddress = vm.envAddress("ROOTS_TOKEN_ADDRESS");
        address airdropAddress = vm.envAddress("SEEDS_AIRDROP_ADDRESS");

        // 100M ROOTS for airdrop (10% of 1B supply)
        uint256 airdropAmount = 100_000_000 * 10**18;

        console.log("=== Fund SeedsAirdrop ===");
        console.log("ROOTS Token:", rootsTokenAddress);
        console.log("SeedsAirdrop:", airdropAddress);
        console.log("Amount:", airdropAmount / 10**18, "ROOTS");

        vm.startBroadcast(deployerPrivateKey);

        ROOTSToken rootsToken = ROOTSToken(rootsTokenAddress);
        rootsToken.transfer(airdropAddress, airdropAmount);

        vm.stopBroadcast();

        SeedsAirdrop airdrop = SeedsAirdrop(airdropAddress);
        uint256 balance = airdrop.availableBalance();

        console.log("");
        console.log("Transfer complete!");
        console.log("SeedsAirdrop balance:", balance / 10**18, "ROOTS");
    }
}

/**
 * @title FundAmbassadorRewards
 * @notice Transfer ROOTS tokens to the AmbassadorRewards contract for Phase 2 commissions
 */
contract FundAmbassadorRewards is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address rootsTokenAddress = vm.envAddress("ROOTS_TOKEN_ADDRESS");
        address ambassadorAddress = vm.envAddress("AMBASSADOR_REWARDS_ADDRESS");

        // 250M ROOTS for ambassador rewards (25% of 1B supply)
        uint256 ambassadorAmount = 250_000_000 * 10**18;

        console.log("=== Fund AmbassadorRewards ===");
        console.log("ROOTS Token:", rootsTokenAddress);
        console.log("AmbassadorRewards:", ambassadorAddress);
        console.log("Amount:", ambassadorAmount / 10**18, "ROOTS");

        vm.startBroadcast(deployerPrivateKey);

        ROOTSToken rootsToken = ROOTSToken(rootsTokenAddress);
        rootsToken.transfer(ambassadorAddress, ambassadorAmount);

        vm.stopBroadcast();

        AmbassadorRewards ambassador = AmbassadorRewards(ambassadorAddress);
        uint256 balance = ambassador.treasuryBalance();

        console.log("");
        console.log("Transfer complete!");
        console.log("AmbassadorRewards balance:", balance / 10**18, "ROOTS");
        console.log("");
        console.log("Don't forget to call initializeTreasury() to enable circuit breakers!");
    }
}

/**
 * @title VerifyPhase2
 * @notice Verify all Phase 2 components are correctly configured
 */
contract VerifyPhase2 is Script {
    function run() external view {
        address rootsToken = vm.envAddress("ROOTS_TOKEN_ADDRESS");
        address marketplaceAddress = vm.envAddress("MARKETPLACE_ADDRESS");
        address ambassadorAddress = vm.envAddress("AMBASSADOR_REWARDS_ADDRESS");
        address airdropAddress = vm.envAddress("SEEDS_AIRDROP_ADDRESS");

        console.log("=== Phase 2 Verification ===");
        console.log("");

        LocalRootsMarketplace marketplace = LocalRootsMarketplace(marketplaceAddress);
        AmbassadorRewards ambassador = AmbassadorRewards(ambassadorAddress);
        SeedsAirdrop airdrop = SeedsAirdrop(airdropAddress);
        ROOTSToken roots = ROOTSToken(rootsToken);

        // Check phases
        bool mpPhase2 = marketplace.currentPhase() == LocalRootsMarketplace.LaunchPhase.Phase2_ROOTS;
        bool ambPhase2 = ambassador.currentPhase() == AmbassadorRewards.LaunchPhase.Phase2_ROOTS;
        bool locked = marketplace.phaseTransitionLocked();

        console.log("Phase Status:");
        console.log("  Marketplace Phase 2:", mpPhase2 ? "YES" : "NO");
        console.log("  AmbassadorRewards Phase 2:", ambPhase2 ? "YES" : "NO");
        console.log("  Transition Locked:", locked ? "YES" : "NO");
        console.log("");

        // Check token configuration
        address mpToken = address(marketplace.rootsToken());
        console.log("Token Configuration:");
        console.log("  Marketplace ROOTS:", mpToken);
        console.log("  Expected ROOTS:", rootsToken);
        console.log("  Match:", mpToken == rootsToken ? "YES" : "NO");
        console.log("");

        // Check balances
        uint256 airdropBalance = airdrop.availableBalance();
        uint256 ambassadorBalance = ambassador.treasuryBalance();
        console.log("Treasury Balances:");
        console.log("  SeedsAirdrop:", airdropBalance / 10**18, "ROOTS");
        console.log("  AmbassadorRewards:", ambassadorBalance / 10**18, "ROOTS");
        console.log("");

        // Check airdrop status
        bytes32 merkleRoot = airdrop.merkleRoot();
        bool periodEnded = airdrop.claimPeriodEnded();
        uint256 timeRemaining = airdrop.timeUntilDeadline();
        console.log("Airdrop Status:");
        console.log("  Merkle Root Set:", merkleRoot != bytes32(0) ? "YES" : "NO");
        console.log("  Claim Period Ended:", periodEnded ? "YES" : "NO");
        console.log("  Time Remaining:", timeRemaining / 86400, "days");
        console.log("");

        // Summary
        bool allGood = mpPhase2 && ambPhase2 && locked &&
                       mpToken == rootsToken &&
                       airdropBalance > 0 &&
                       ambassadorBalance > 0 &&
                       merkleRoot != bytes32(0) &&
                       !periodEnded;

        console.log("=== Summary ===");
        if (allGood) {
            console.log("ALL CHECKS PASSED - Phase 2 is fully operational!");
        } else {
            console.log("SOME CHECKS FAILED - Review the output above");
        }
    }
}
