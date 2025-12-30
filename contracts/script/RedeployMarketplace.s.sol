// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @notice Script to redeploy just the marketplace contract
 * @dev Uses existing token and ambassador rewards addresses
 *      Note: Ambassador rewards will still point to old marketplace
 *      This is for testnet iteration - rewards won't work until full redeploy
 */
contract RedeployMarketplace is Script {
    // Existing deployed contract addresses on Base Sepolia
    address constant ROOTS_TOKEN = 0x509dd8D46E66C6B6591c111551C6E6039941E63C;
    address constant AMBASSADOR_REWARDS = 0x15B1b3b0f08d518005a36B8F41eaC7B6F3Ac8B22;

    function run() external returns (LocalRootsMarketplace marketplace, ERC2771Forwarder forwarder) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy forwarder for gasless transactions
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");

        // Deploy new marketplace with forwarder
        marketplace = new LocalRootsMarketplace(
            ROOTS_TOKEN,
            AMBASSADOR_REWARDS,
            address(forwarder)
        );

        console.log("=== Marketplace Redeployment Complete ===");
        console.log("ERC2771Forwarder:", address(forwarder));
        console.log("New LocalRootsMarketplace:", address(marketplace));
        console.log("");
        console.log("UPDATE frontend/src/lib/contracts/marketplace.ts:");
        console.log("MARKETPLACE_ADDRESS:", address(marketplace));
        console.log("FORWARDER_ADDRESS:", address(forwarder));
        console.log("");
        console.log("NOTE: Ambassador rewards still points to old marketplace.");
        console.log("      Rewards will not work until full system redeploy.");

        vm.stopBroadcast();
    }
}
