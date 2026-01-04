// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @notice Script to redeploy the marketplace contract with payment token support
 * @dev Uses existing token and ambassador rewards addresses
 */
contract RedeployMarketplace is Script {
    // Existing deployed contract addresses on Base Sepolia (v3)
    address constant ROOTS_TOKEN = 0xffDAa58B1EB72c81ba8B728880b18A8E52409Ac7;
    address constant AMBASSADOR_REWARDS = 0x6838063D4A7fBdDc62E3886e6306e3076267c29d;

    // Payment support contracts
    address constant MOCK_USDC = 0x46d25975B3C6894Bab136416520b642B7F6BE8E7;
    address constant MOCK_USDT = 0xC124130852Fa56634D1DC7ee8A0dF288DFcF70A8;
    address constant SWAP_ROUTER = 0xa49BA7c5444D4CCce5cc44aBd9b2dfb9CADf758f;

    function run() external returns (LocalRootsMarketplace marketplace, ERC2771Forwarder forwarder) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy forwarder for gasless transactions
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");

        // Deploy new marketplace with forwarder and initial admin (Phase 2 mode)
        marketplace = new LocalRootsMarketplace(
            ROOTS_TOKEN,
            AMBASSADOR_REWARDS,
            address(forwarder),
            deployer,  // Initial admin is the deployer
            LocalRootsMarketplace.LaunchPhase.Phase2_ROOTS
        );

        // Configure payment token support
        marketplace.setSwapRouter(SWAP_ROUTER);
        marketplace.addPaymentToken(MOCK_USDC);
        marketplace.addPaymentToken(MOCK_USDT);

        // Note: Ambassador rewards marketplace can only be set once
        // If redeploying, the old marketplace link remains (rewards won't work until full redeploy)

        console.log("=== Marketplace Redeployment Complete ===");
        console.log("ERC2771Forwarder:", address(forwarder));
        console.log("New LocalRootsMarketplace:", address(marketplace));
        console.log("");
        console.log("Payment Support Configured:");
        console.log("  SwapRouter:", SWAP_ROUTER);
        console.log("  MockUSDC:", MOCK_USDC);
        console.log("  MockUSDT:", MOCK_USDT);
        console.log("");
        console.log("UPDATE frontend/src/lib/contracts/marketplace.ts:");
        console.log("  MARKETPLACE_ADDRESS:", address(marketplace));
        console.log("  FORWARDER_ADDRESS:", address(forwarder));

        vm.stopBroadcast();
    }
}
