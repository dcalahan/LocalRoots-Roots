// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FundTestWallet is Script {
    // ROOTS token on Base Sepolia
    address constant ROOTS_TOKEN = 0x509dd8D46E66C6B6591c111551C6E6039941E63C;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address recipient = vm.envAddress("RECIPIENT");
        uint256 amount = vm.envOr("AMOUNT", uint256(1000 * 10**18)); // Default 1000 ROOTS

        vm.startBroadcast(deployerPrivateKey);

        IERC20 roots = IERC20(ROOTS_TOKEN);

        uint256 balance = roots.balanceOf(vm.addr(deployerPrivateKey));
        console.log("Sender ROOTS balance:", balance / 10**18);

        require(balance >= amount, "Insufficient ROOTS balance");

        roots.transfer(recipient, amount);

        console.log("=== Test Wallet Funded ===");
        console.log("Recipient:", recipient);
        console.log("Amount:", amount / 10**18, "ROOTS");

        vm.stopBroadcast();
    }
}
