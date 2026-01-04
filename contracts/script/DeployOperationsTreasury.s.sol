// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/operations/OperationsTreasury.sol";

/**
 * @title DeployOperationsTreasury
 * @notice Deployment script for the Operations Treasury contract
 * @dev Deploys an Operations Treasury controlled by a Gnosis Safe multisig
 *
 * Prerequisites:
 *   1. Create a Gnosis Safe at https://app.safe.global
 *   2. Set OPERATIONS_SAFE_ADDRESS in your .env file
 *   3. Fund the Safe with USDC for operational costs
 *
 * Usage:
 *   forge script script/DeployOperationsTreasury.s.sol:DeployOperationsTreasury \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployOperationsTreasury is Script {
    // USDC on Base Sepolia
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // USDC on Base Mainnet
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // Service IDs (pre-computed keccak256 hashes)
    bytes32 constant SERVICE_ANTHROPIC = keccak256("anthropic");
    bytes32 constant SERVICE_PINATA = keccak256("pinata");
    bytes32 constant SERVICE_CROSSMINT = keccak256("crossmint");
    bytes32 constant SERVICE_THIRDWEB = keccak256("thirdweb");
    bytes32 constant SERVICE_PRIVY = keccak256("privy");

    OperationsTreasury public treasury;

    function run() external {
        // Load environment variables
        address safeAddress = vm.envAddress("OPERATIONS_SAFE_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Determine USDC address based on chain
        address usdcAddress = block.chainid == 8453 ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;

        console.log("=== Operations Treasury Deployment ===");
        console.log("Chain ID:", block.chainid);
        console.log("Safe Address:", safeAddress);
        console.log("USDC Address:", usdcAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Operations Treasury
        treasury = new OperationsTreasury(safeAddress, usdcAddress);
        console.log("OperationsTreasury deployed at:", address(treasury));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Fund the treasury with USDC");
        console.log("2. Configure services via the Safe (see configureServices script)");
        console.log("");
        console.log("Service IDs:");
        console.log("  anthropic:", vm.toString(SERVICE_ANTHROPIC));
        console.log("  pinata:", vm.toString(SERVICE_PINATA));
        console.log("  crossmint:", vm.toString(SERVICE_CROSSMINT));
        console.log("  thirdweb:", vm.toString(SERVICE_THIRDWEB));
        console.log("  privy:", vm.toString(SERVICE_PRIVY));
    }
}

/**
 * @title ConfigureServices
 * @notice Script to configure initial services in the Operations Treasury
 * @dev This must be called from the Gnosis Safe
 *
 * Usage (via Safe Transaction Builder):
 *   1. Go to app.safe.global > Transaction Builder
 *   2. Add configureService calls for each service
 *   3. Submit for multisig approval
 */
contract ConfigureServices is Script {
    // Monthly budgets in USDC (6 decimals)
    // $5 = 5_000_000
    uint256 constant BUDGET_ANTHROPIC = 5_000_000;      // $5/month
    uint256 constant BUDGET_PINATA = 25_000_000;        // $25/month
    uint256 constant BUDGET_CROSSMINT = 20_000_000;     // $20/month
    uint256 constant BUDGET_THIRDWEB = 15_000_000;      // $15/month
    uint256 constant BUDGET_PRIVY = 50_000_000;         // $50/month

    function run() external view {
        // This script outputs the calldata for configuring services
        // You'll need to submit these calls via the Gnosis Safe

        console.log("=== Service Configuration Calldata ===");
        console.log("");
        console.log("Submit these calls via the Gnosis Safe Transaction Builder:");
        console.log("");

        // Note: Replace PAYEE_ADDRESS with actual payment addresses
        console.log("1. Anthropic (off-ramp required):");
        console.log("   serviceId: ", vm.toString(keccak256("anthropic")));
        console.log("   name: Anthropic");
        console.log("   payee: <COINBASE_DEPOSIT_ADDRESS>");
        console.log("   monthlyBudget:", BUDGET_ANTHROPIC);
        console.log("   requiresOfframp: true");
        console.log("");

        console.log("2. Pinata (direct crypto):");
        console.log("   serviceId: ", vm.toString(keccak256("pinata")));
        console.log("   name: Pinata");
        console.log("   payee: <PINATA_WALLET_ADDRESS>");
        console.log("   monthlyBudget:", BUDGET_PINATA);
        console.log("   requiresOfframp: false");
        console.log("");

        console.log("3. Crossmint (direct crypto):");
        console.log("   serviceId: ", vm.toString(keccak256("crossmint")));
        console.log("   name: Crossmint");
        console.log("   payee: <CROSSMINT_WALLET_ADDRESS>");
        console.log("   monthlyBudget:", BUDGET_CROSSMINT);
        console.log("   requiresOfframp: false");
        console.log("");

        console.log("4. thirdweb (direct crypto):");
        console.log("   serviceId: ", vm.toString(keccak256("thirdweb")));
        console.log("   name: thirdweb");
        console.log("   payee: <THIRDWEB_WALLET_ADDRESS>");
        console.log("   monthlyBudget:", BUDGET_THIRDWEB);
        console.log("   requiresOfframp: false");
        console.log("");

        console.log("5. Privy (off-ramp required):");
        console.log("   serviceId: ", vm.toString(keccak256("privy")));
        console.log("   name: Privy");
        console.log("   payee: <COINBASE_DEPOSIT_ADDRESS>");
        console.log("   monthlyBudget:", BUDGET_PRIVY);
        console.log("   requiresOfframp: true");
    }
}
