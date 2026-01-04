// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/MockSwapRouter.sol";
import "../src/LocalRootsMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployPaymentSupport
 * @notice Deploys mock USDC, USDT, and SwapRouter for testnet
 * @dev Run with: forge script script/DeployPaymentSupport.s.sol --rpc-url $RPC_URL --broadcast
 */
contract DeployPaymentSupport is Script {
    // Existing deployed contracts (Base Sepolia) - Jan 2 fresh deployment
    address constant ROOTS_TOKEN = 0x33eFBF74Df84193Ce39dfF91394d9A0fE20c36c3;
    address constant MARKETPLACE = 0xEe6eCF5A36925C4D95097ffa2F40632bf500a0F8;
    address constant TREASURY = 0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c;

    // Swap router ROOTS liquidity (1M ROOTS for initial liquidity)
    uint256 constant SWAP_ROUTER_LIQUIDITY = 1_000_000 * 10**18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying payment support contracts...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy MockUSDT
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(usdt));

        // Deploy MockSwapRouter
        MockSwapRouter swapRouter = new MockSwapRouter(ROOTS_TOKEN);
        console.log("MockSwapRouter deployed at:", address(swapRouter));

        // Add stablecoins to swap router
        swapRouter.addStablecoin(address(usdc));
        swapRouter.addStablecoin(address(usdt));
        console.log("Stablecoins added to swap router");

        vm.stopBroadcast();

        // Note: Swap router needs to be funded with ROOTS manually after deployment
        console.log("NOTE: Fund swap router with ROOTS manually using cast send");

        // Print summary
        console.log("\n=== Deployment Summary ===");
        console.log("MockUSDC:", address(usdc));
        console.log("MockUSDT:", address(usdt));
        console.log("MockSwapRouter:", address(swapRouter));
        console.log("\n=== Next Steps ===");
        console.log("1. Configure marketplace with payment support:");
        console.log("   marketplace.setSwapRouter(", address(swapRouter), ")");
        console.log("   marketplace.addPaymentToken(", address(usdc), ")");
        console.log("   marketplace.addPaymentToken(", address(usdt), ")");
        console.log("2. If swap router needs more ROOTS liquidity:");
        console.log("   ROOTS.transfer(", address(swapRouter), ", amount)");
        console.log("3. Mint test stablecoins to users:");
        console.log("   usdc.mint(userAddress, amount)");
    }
}
