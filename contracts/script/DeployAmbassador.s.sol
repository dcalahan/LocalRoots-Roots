// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AmbassadorRewards.sol";

contract DeployAmbassador is Script {
    function run() external {
        address rootsToken = 0x509dd8D46E66C6B6591c111551C6E6039941E63C;

        vm.startBroadcast();

        AmbassadorRewards ambassador = new AmbassadorRewards(rootsToken);

        console.log("AmbassadorRewards deployed at:", address(ambassador));

        vm.stopBroadcast();
    }
}
