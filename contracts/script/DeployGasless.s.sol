// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @notice Deploy gasless-enabled contracts
 * @dev Deploys forwarder, marketplace, and ambassador rewards
 *      Uses existing RootsToken address
 */
contract DeployGasless is Script {
    // Existing RootsToken on Base Sepolia
    address constant ROOTS_TOKEN = 0x509dd8D46E66C6B6591c111551C6E6039941E63C;

    function run() external returns (
        ERC2771Forwarder forwarder,
        AmbassadorRewards ambassadorRewards,
        LocalRootsMarketplace marketplace
    ) {
        vm.startBroadcast();

        // 1. Deploy ERC2771Forwarder
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");
        console.log("ERC2771Forwarder deployed at:", address(forwarder));

        // 2. Deploy AmbassadorRewards with forwarder
        ambassadorRewards = new AmbassadorRewards(ROOTS_TOKEN, address(forwarder));
        console.log("AmbassadorRewards deployed at:", address(ambassadorRewards));

        // 3. Deploy LocalRootsMarketplace with forwarder (Phase 2 mode with token)
        marketplace = new LocalRootsMarketplace(
            ROOTS_TOKEN,
            address(ambassadorRewards),
            address(forwarder),
            msg.sender,  // Initial admin is the deployer
            LocalRootsMarketplace.LaunchPhase.Phase2_ROOTS
        );
        console.log("LocalRootsMarketplace deployed at:", address(marketplace));

        // 4. Set marketplace in ambassador rewards
        ambassadorRewards.setMarketplace(address(marketplace));
        console.log("Marketplace set in AmbassadorRewards");

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("Update frontend/src/lib/contracts/marketplace.ts:");
        console.log("  MARKETPLACE_ADDRESS:", address(marketplace));
        console.log("");
        console.log("Update frontend/src/lib/contracts/ambassador.ts:");
        console.log("  AMBASSADOR_REWARDS_ADDRESS:", address(ambassadorRewards));
        console.log("");
        console.log("Add to frontend .env.local:");
        console.log("  NEXT_PUBLIC_FORWARDER_ADDRESS:", address(forwarder));
        console.log("");
        console.log("IMPORTANT: Register State Founder on new AmbassadorRewards contract!");

        vm.stopBroadcast();
    }
}
