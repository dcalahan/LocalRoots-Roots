// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AmbassadorRewards.sol";

contract DeployAmbassadorRewards is Script {
    function run() external returns (AmbassadorRewards ambassadorRewards) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Existing contract addresses from Jan 2 deployment
        address tokenAddress = 0x33eFBF74Df84193Ce39dfF91394d9A0fE20c36c3;
        address forwarderAddress = 0x63e7eb99daE531227dD690A031eAD1d8d5BeAc54;
        address marketplaceAddress = 0xEe6eCF5A36925C4D95097ffa2F40632bf500a0F8;

        vm.startBroadcast(deployerPrivateKey);

        // Deploy updated AmbassadorRewards
        ambassadorRewards = new AmbassadorRewards(tokenAddress, forwarderAddress);

        // Set marketplace
        ambassadorRewards.setMarketplace(marketplaceAddress);

        console.log("=== AmbassadorRewards Deployed ===");
        console.log("AmbassadorRewards:", address(ambassadorRewards));
        console.log("Token:", tokenAddress);
        console.log("Forwarder:", forwarderAddress);
        console.log("Marketplace:", marketplaceAddress);

        vm.stopBroadcast();
    }
}
