// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";

contract SetupTestData is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address marketplace = 0xe132403fB9998CdDe2E6Cf3eef3B55617ffe16aA;

        vm.startBroadcast(deployerPrivateKey);

        LocalRootsMarketplace mp = LocalRootsMarketplace(marketplace);

        // Register a test seller (Hilton Head area - geohash prefix "djq")
        // Using test IPFS hash for metadata
        bytes8 geohash = bytes8("djqm4p5"); // Hilton Head area
        string memory storefrontIpfs = "test-seller-hiltonhead";

        uint256 sellerId = mp.registerSeller(
            geohash,
            storefrontIpfs,
            true,  // offers delivery
            true,  // offers pickup
            10     // 10km delivery radius
        );
        console.log("Seller registered with ID:", sellerId);

        // Create test listings
        // Listing 1: Tomatoes
        uint256 listing1 = mp.createListing(
            "test-tomatoes",
            5 * 10**18,  // 5 ROOTS per unit
            100          // 100 available
        );
        console.log("Listing 1 (Tomatoes) created with ID:", listing1);

        // Listing 2: Peppers
        uint256 listing2 = mp.createListing(
            "test-peppers",
            3 * 10**18,  // 3 ROOTS per unit
            50           // 50 available
        );
        console.log("Listing 2 (Peppers) created with ID:", listing2);

        // Listing 3: Basil
        uint256 listing3 = mp.createListing(
            "test-basil",
            2 * 10**18,  // 2 ROOTS per unit
            25           // 25 available
        );
        console.log("Listing 3 (Basil) created with ID:", listing3);

        vm.stopBroadcast();

        console.log("=== Test Data Setup Complete ===");
        console.log("Seller ID:", sellerId);
        console.log("Listings:", listing1, listing2, listing3);
    }
}
