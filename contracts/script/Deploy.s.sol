// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RootsToken.sol";
import "../src/FounderVesting.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address founder = vm.envAddress("FOUNDER_ADDRESS");
        address liquidityPool = vm.envAddress("LIQUIDITY_POOL_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address airdrop = vm.envAddress("AIRDROP_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Ambassador Rewards (needs token address, will set later)
        // We use a placeholder, then redeploy after token
        address tempToken = address(1);

        // 2. Deploy Founder Vesting
        FounderVesting founderVesting = new FounderVesting(tempToken, founder);

        // 3. Deploy Forwarder for gasless transactions
        ERC2771Forwarder forwarder = new ERC2771Forwarder("LocalRootsForwarder");

        // 4. Deploy Ambassador Rewards
        AmbassadorRewards ambassadorRewards = new AmbassadorRewards(tempToken, address(forwarder));

        // For now, we'll deploy with placeholder addresses
        // In production, deploy in correct order or use proxies

        console.log("=== Deployment Addresses ===");
        console.log("Forwarder:", address(forwarder));
        console.log("FounderVesting:", address(founderVesting));
        console.log("AmbassadorRewards:", address(ambassadorRewards));

        vm.stopBroadcast();
    }
}

/**
 * @notice Full deployment script with proper ordering
 */
contract DeployAll is Script {
    function run() external returns (
        RootsToken token,
        FounderVesting founderVesting,
        AmbassadorRewards ambassadorRewards,
        LocalRootsMarketplace marketplace,
        ERC2771Forwarder forwarder
    ) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address founder = vm.envAddress("FOUNDER_ADDRESS");
        address liquidityPool = vm.envAddress("LIQUIDITY_POOL_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address airdrop = vm.envAddress("AIRDROP_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy Forwarder first (for gasless transactions)
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");

        // Step 2: Compute future addresses using CREATE
        address deployer = vm.addr(deployerPrivateKey);
        uint64 nonce = vm.getNonce(deployer);

        // Addresses will be deployed in order:
        // nonce+0: FounderVesting
        // nonce+1: AmbassadorRewards
        // nonce+2: RootsToken
        // nonce+3: LocalRootsMarketplace

        address predictedVesting = computeCreateAddress(deployer, uint256(nonce));
        address predictedAmbassador = computeCreateAddress(deployer, uint256(nonce) + 1);
        address predictedToken = computeCreateAddress(deployer, uint256(nonce) + 2);

        // Step 3: Deploy FounderVesting
        founderVesting = new FounderVesting(predictedToken, founder);
        require(address(founderVesting) == predictedVesting, "Vesting address mismatch");

        // Step 4: Deploy AmbassadorRewards (with forwarder)
        ambassadorRewards = new AmbassadorRewards(predictedToken, address(forwarder));
        require(address(ambassadorRewards) == predictedAmbassador, "Ambassador address mismatch");

        // Step 5: Deploy RootsToken with all addresses
        token = new RootsToken(
            address(founderVesting),
            address(ambassadorRewards),
            liquidityPool,
            treasury,
            airdrop
        );
        require(address(token) == predictedToken, "Token address mismatch");

        // Step 6: Deploy Marketplace (with forwarder and initial admin = deployer)
        marketplace = new LocalRootsMarketplace(
            address(token),
            address(ambassadorRewards),
            address(forwarder),
            deployer  // Initial admin is the deployer (use computed address, not msg.sender)
        );

        // Step 7: Configure AmbassadorRewards
        ambassadorRewards.setMarketplace(address(marketplace));

        // Step 8: Initialize founder vesting
        founderVesting.initializeAllocation();

        console.log("=== Deployment Complete ===");
        console.log("ERC2771Forwarder:", address(forwarder));
        console.log("RootsToken:", address(token));
        console.log("FounderVesting:", address(founderVesting));
        console.log("AmbassadorRewards:", address(ambassadorRewards));
        console.log("LocalRootsMarketplace:", address(marketplace));

        vm.stopBroadcast();
    }
}
