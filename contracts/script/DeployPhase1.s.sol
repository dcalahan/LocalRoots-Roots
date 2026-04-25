// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LocalRootsMarketplace.sol";
import "../src/AmbassadorRewards.sol";
import "../src/DisputeResolution.sol";
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title DeployPhase1
 * @notice Deployment script for Phase 1 (USDC-only, Seeds tracking)
 * @dev Phase 1 characteristics:
 *      - No ROOTS token deployed or used
 *      - Marketplace accepts USDC only
 *      - All activity emits Seeds events for indexing by TheGraph
 *      - Ambassador rewards are tracked as Seeds, not distributed as tokens
 *
 * Usage:
 *   forge script script/DeployPhase1.s.sol:DeployPhase1 \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */
contract DeployPhase1 is Script {
    // Deployed contract references
    ERC2771Forwarder public forwarder;
    AmbassadorRewards public ambassadorRewards;
    LocalRootsMarketplace public marketplace;
    DisputeResolution public disputeResolution;

    // USDC addresses (Circle's official deployments)
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address deployer = vm.envAddress("FOUNDER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // INITIAL_ADMIN is the wallet that gets admin role on the contracts.
        // SECURITY: keep this separate from the deployer wallet so a compromised
        // deployer key (which sees the most exposure during deployment) does not
        // also retain admin powers on the deployed contracts. Defaults to deployer
        // for backwards compatibility with testnet runs that didn't set it.
        address initialAdmin = vm.envOr("INITIAL_ADMIN", deployer);

        // USDC address: auto-pick by chain ID, or override with USDC_ADDRESS env.
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        if (usdcAddress == address(0)) {
            if (block.chainid == 8453) {
                usdcAddress = USDC_BASE_MAINNET;
            } else if (block.chainid == 84532) {
                usdcAddress = USDC_BASE_SEPOLIA;
            } else {
                revert("Unknown chain - set USDC_ADDRESS env var");
            }
        }

        string memory networkName;
        if (block.chainid == 8453) networkName = "Base MAINNET";
        else if (block.chainid == 84532) networkName = "Base Sepolia";
        else networkName = "Unknown chain";

        console.log("=== Phase 1 Deployment ===");
        console.log("Network:       ", networkName);
        console.log("Chain ID:      ", block.chainid);
        console.log("Deployer:      ", deployer);
        console.log("Initial admin: ", initialAdmin);
        console.log("USDC address:  ", usdcAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy ERC2771Forwarder for gasless transactions
        forwarder = new ERC2771Forwarder("LocalRootsForwarder");
        console.log("ERC2771Forwarder deployed at:", address(forwarder));

        // Step 2: Deploy AmbassadorRewards
        // Note: In Phase 1, rootsToken is set to a dummy address since rewards are Seeds-based
        // The contract still requires a non-zero address, so we use USDC address as placeholder
        // (No ROOTS tokens will be transferred in Phase 1)
        ambassadorRewards = new AmbassadorRewards(usdcAddress, address(forwarder));
        console.log("AmbassadorRewards deployed at:", address(ambassadorRewards));

        // Step 3: Deploy Marketplace in Phase 1 mode
        marketplace = new LocalRootsMarketplace(
            address(0),                                          // No ROOTS token in Phase 1
            address(ambassadorRewards),
            address(forwarder),
            initialAdmin,                                        // Initial admin (separate from deployer)
            LocalRootsMarketplace.LaunchPhase.Phase1_USDC,       // Start in Phase 1
            usdcAddress                                          // Phase 1 payment token
        );
        console.log("LocalRootsMarketplace deployed at:", address(marketplace));

        // Step 4: Deploy DisputeResolution
        disputeResolution = new DisputeResolution(
            address(ambassadorRewards),
            address(marketplace),
            address(forwarder),
            initialAdmin
        );
        console.log("DisputeResolution deployed at:", address(disputeResolution));

        // Step 5: Configure AmbassadorRewards
        ambassadorRewards.setMarketplace(address(marketplace));
        console.log("Marketplace configured in AmbassadorRewards");

        // Step 5: Add USDC as accepted payment token (if needed)
        // Note: In Phase 1, USDC is the ONLY payment option
        // marketplace.addPaymentToken(USDC_ADDRESS);  // Not needed - hardcoded

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 1 Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  ERC2771Forwarder:", address(forwarder));
        console.log("  AmbassadorRewards:", address(ambassadorRewards));
        console.log("  LocalRootsMarketplace:", address(marketplace));
        console.log("  DisputeResolution:", address(disputeResolution));
        console.log("");
        console.log("Phase 1 Configuration:");
        console.log("  Payment Token: USDC only (", usdcAddress, ")");
        console.log("  Rewards: Seeds (tracked on-chain, indexed by TheGraph)");
        console.log("  Seeds Ratios: 500 Seeds per $1 (sellers), 50 Seeds per $1 (buyers)");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Deploy TheGraph subgraph to index Seeds events");
        console.log("  2. Configure frontend with NEXT_PUBLIC_LAUNCH_PHASE=phase1");
        console.log("  3. Register State Founders in AmbassadorRewards");
        console.log("  4. Update frontend contract addresses");
    }
}
