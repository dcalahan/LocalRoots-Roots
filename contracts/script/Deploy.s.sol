// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RootsToken.sol";
import "../src/FounderVesting.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";

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

        // 3. Deploy Ambassador Rewards
        AmbassadorRewards ambassadorRewards = new AmbassadorRewards(tempToken);

        // For now, we'll deploy with placeholder addresses
        // In production, deploy in correct order or use proxies

        console.log("=== Deployment Addresses ===");
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
        LocalRootsMarketplace marketplace
    ) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address founder = vm.envAddress("FOUNDER_ADDRESS");
        address liquidityPool = vm.envAddress("LIQUIDITY_POOL_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address airdrop = vm.envAddress("AIRDROP_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Compute future addresses using CREATE
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

        // Step 2: Deploy FounderVesting
        founderVesting = new FounderVesting(predictedToken, founder);
        require(address(founderVesting) == predictedVesting, "Vesting address mismatch");

        // Step 3: Deploy AmbassadorRewards
        ambassadorRewards = new AmbassadorRewards(predictedToken);
        require(address(ambassadorRewards) == predictedAmbassador, "Ambassador address mismatch");

        // Step 4: Deploy RootsToken with all addresses
        token = new RootsToken(
            address(founderVesting),
            address(ambassadorRewards),
            liquidityPool,
            treasury,
            airdrop
        );
        require(address(token) == predictedToken, "Token address mismatch");

        // Step 5: Deploy Marketplace
        marketplace = new LocalRootsMarketplace(
            address(token),
            address(ambassadorRewards)
        );

        // Step 6: Configure AmbassadorRewards
        ambassadorRewards.setMarketplace(address(marketplace));

        // Step 7: Initialize founder vesting
        founderVesting.initializeAllocation();

        console.log("=== Deployment Complete ===");
        console.log("RootsToken:", address(token));
        console.log("FounderVesting:", address(founderVesting));
        console.log("AmbassadorRewards:", address(ambassadorRewards));
        console.log("LocalRootsMarketplace:", address(marketplace));

        vm.stopBroadcast();
    }
}
