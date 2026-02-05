import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.RPC_URL || 'https://base-sepolia-rpc.publicnode.com';

// Public client for read-only operations
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// Deployer (contract owner, can mint test tokens)
const deployerAccount = privateKeyToAccount(
  process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`
);
export const deployerClient = createWalletClient({
  account: deployerAccount,
  chain: baseSepolia,
  transport: http(RPC_URL),
});
export const deployerAddress = deployerAccount.address;

// Ambassador
const ambassadorAccount = privateKeyToAccount(
  process.env.AMBASSADOR_PRIVATE_KEY as `0x${string}`
);
export const ambassadorClient = createWalletClient({
  account: ambassadorAccount,
  chain: baseSepolia,
  transport: http(RPC_URL),
});
export const ambassadorAddress = ambassadorAccount.address;
export { ambassadorAccount };

// Seller
const sellerAccount = privateKeyToAccount(
  process.env.SELLER_PRIVATE_KEY as `0x${string}`
);
export const sellerClient = createWalletClient({
  account: sellerAccount,
  chain: baseSepolia,
  transport: http(RPC_URL),
});
export const sellerAddress = sellerAccount.address;
export { sellerAccount };

// Buyer
const buyerAccount = privateKeyToAccount(
  process.env.BUYER_PRIVATE_KEY as `0x${string}`
);
export const buyerClient = createWalletClient({
  account: buyerAccount,
  chain: baseSepolia,
  transport: http(RPC_URL),
});
export const buyerAddress = buyerAccount.address;
export { buyerAccount };

// Log addresses on import for debugging
console.log('[E2E] Test wallets:');
console.log('  Deployer:', deployerAddress);
console.log('  Ambassador:', ambassadorAddress);
console.log('  Seller:', sellerAddress);
console.log('  Buyer:', buyerAddress);
