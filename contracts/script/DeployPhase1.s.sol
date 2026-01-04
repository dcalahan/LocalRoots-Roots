// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title DeployPhase1
 * @notice Deployment script for Phase 1 (USDC-only, Seeds tracking)
 * @dev Phase 1 characteristics:
 *      - No ROOTS token deployed or used
 *      - Marketplace accepts USDC only
 *      - All activity emits Seeds events for indexing by TheGraph
 *      - Ambassador rewards are tracked as Seeds, not distributed as tokens
 *
 * Usage:
 *   forge script script/DeployPhase1.s.sol:DeployPhase1 \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */
contract DeployPhase1 is Script {
    // Deployed contract references
    ERC2771Forwarder public forwarder;
    AmbassadorRewards public ambassadorRewards;
    LocalRootsMarketplace public marketplace;

    // USDC on Base Sepolia (Circle's official testnet USDC)
    address constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address deployer = vm.envAddress("FOUNDER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Phase 1 Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Network: Base Sepolia (Phase 1 - USDC only)");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy ERC2771Forwarder for gasless transactions
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");
        console.log("ERC2771Forwarder deployed at:", address(forwarder));

        // Step 2: Deploy AmbassadorRewards
        // Note: In Phase 1, rootsToken is set to a dummy address since rewards are Seeds-based
        // The contract still requires a non-zero address, so we use USDC address as placeholder
        // (No ROOTS tokens will be transferred in Phase 1)
        ambassadorRewards = new AmbassadorRewards(USDC_ADDRESS, address(forwarder));
        console.log("AmbassadorRewards deployed at:", address(ambassadorRewards));

        // Step 3: Deploy Marketplace in Phase 1 mode
        marketplace = new LocalRootsMarketplace(
            address(0),                                          // No ROOTS token in Phase 1
            address(ambassadorRewards),
            address(forwarder),
            deployer,                                            // Initial admin
            LocalRootsMarketplace.LaunchPhase.Phase1_USDC        // Start in Phase 1
        );
        console.log("LocalRootsMarketplace deployed at:", address(marketplace));

        // Step 4: Configure AmbassadorRewards
        ambassadorRewards.setMarketplace(address(marketplace));
        console.log("Marketplace configured in AmbassadorRewards");

        // Step 5: Add USDC as accepted payment token (if needed)
        // Note: In Phase 1, USDC is the ONLY payment option
        // marketplace.addPaymentToken(USDC_ADDRESS);  // Not needed - hardcoded

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 1 Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  ERC2771Forwarder:", address(forwarder));
        console.log("  AmbassadorRewards:", address(ambassadorRewards));
        console.log("  LocalRootsMarketplace:", address(marketplace));
        console.log("");
        console.log("Phase 1 Configuration:");
        console.log("  Payment Token: USDC only (", USDC_ADDRESS, ")");
        console.log("  Rewards: Seeds (tracked on-chain, indexed by TheGraph)");
        console.log("  Seeds Ratios: 500 Seeds per $1 (sellers), 50 Seeds per $1 (buyers)");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Deploy TheGraph subgraph to index Seeds events");
        console.log("  2. Configure frontend with NEXT_PUBLIC_LAUNCH_PHASE=phase1");
        console.log("  3. Register State Founders in AmbassadorRewards");
        console.log("  4. Update frontend contract addresses");
    }
}
