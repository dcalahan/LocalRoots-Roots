// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DisputeResolution.sol";
import "../src/GovernmentRequests.sol";

/**
 * @notice Deploy governance contracts (DisputeResolution + GovernmentRequests)
 * @dev These contracts integrate with existing deployed contracts:
 *      - AmbassadorRewards: 0xC596B9FcCAC989abf4B4244EC8c74CF8d50DDB91
 *      - Marketplace: 0xBAc288595e52AF2dDF560CEaEf90064463c08f0d
 *      - Forwarder: 0xd6632078F9ad1Fb03a9Babd2908cBA4D00D43F74
 *
 * Usage:
 *   export PRIVATE_KEY=<deployer-private-key>
 *   forge script script/DeployGovernance.s.sol:DeployGovernance --rpc-url https://sepolia.base.org --broadcast -vvv
 */
contract DeployGovernance is Script {
    // Existing deployed contracts (Base Sepolia)
    address constant AMBASSADOR_REWARDS = 0xC596B9FcCAC989abf4B4244EC8c74CF8d50DDB91;
    address constant MARKETPLACE = 0xBAc288595e52AF2dDF560CEaEf90064463c08f0d;
    address constant FORWARDER = 0xd6632078F9ad1Fb03a9Babd2908cBA4D00D43F74;

    function run() external returns (
        DisputeResolution disputeResolution,
        GovernmentRequests governmentRequests
    ) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Deploying Governance Contracts ===");
        console.log("Deployer:", deployer);
        console.log("Using AmbassadorRewards:", AMBASSADOR_REWARDS);
        console.log("Using Marketplace:", MARKETPLACE);
        console.log("Using Forwarder:", FORWARDER);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy DisputeResolution
        disputeResolution = new DisputeResolution(
            AMBASSADOR_REWARDS,
            MARKETPLACE,
            FORWARDER,
            deployer  // Initial admin
        );

        // Deploy GovernmentRequests
        governmentRequests = new GovernmentRequests(
            AMBASSADOR_REWARDS,
            FORWARDER,
            deployer  // Initial admin
        );

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("DisputeResolution:", address(disputeResolution));
        console.log("GovernmentRequests:", address(governmentRequests));
        console.log("");
        console.log("=== Next Steps ===");
        console.log("1. Update frontend/.env.local with:");
        console.log("   NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS=", address(disputeResolution));
        console.log("   NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS=", address(governmentRequests));
        console.log("");
        console.log("2. Update subgraph/subgraph.yaml with new addresses");
        console.log("3. Deploy updated subgraph");

        vm.stopBroadcast();
    }
}
