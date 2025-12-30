// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AmbassadorRewards.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract DeployAmbassador is Script {
    function run() external {
        address rootsToken = 0x509dd8D46E66C6B6591c111551C6E6039941E63C;

        vm.startBroadcast();

        // Deploy forwarder for gasless transactions
        ERC2771Forwarder forwarder = new ERC2771Forwarder("LocalRootsForwarder");

        // Deploy ambassador rewards with forwarder
        AmbassadorRewards ambassador = new AmbassadorRewards(rootsToken, address(forwarder));

        console.log("ERC2771Forwarder deployed at:", address(forwarder));
        console.log("AmbassadorRewards deployed at:", address(ambassador));

        vm.stopBroadcast();
    }
}
