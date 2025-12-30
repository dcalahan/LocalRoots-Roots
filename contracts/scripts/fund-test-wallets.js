const { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const DEPLOYER_KEY = '0x230a5604a90c138dfd766fa341ab85edbf1a0383f5b27f82886b51b79aabe282';
const ROOTS_TOKEN = '0x509dd8D46E66C6B6591c111551C6E6039941E63C';

const TEST_WALLETS = [
  { name: 'Seller', address: '0xde061f740C49BD9Dc0c25e4FC5eF9E0CF6ED00e0' },
  { name: 'Buyer', address: '0x0C0f738485B07bd98b6f0633C62C2c87e1b366c0' },
  { name: 'Ambassador', address: '0x76CDc4B652AB397D345F893f5bdE14dE4632a8Eb' },
];

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

async function main() {
  const account = privateKeyToAccount(DEPLOYER_KEY);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Check deployer balances
  const deployerEth = await publicClient.getBalance({ address: account.address });
  const deployerRoots = await publicClient.readContract({
    address: ROOTS_TOKEN,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log('=== DEPLOYER WALLET ===');
  console.log('Address:', account.address);
  console.log('ETH Balance:', formatEther(deployerEth));
  console.log('ROOTS Balance:', formatUnits(deployerRoots, 18));
  console.log('');

  // Amount to send to each wallet
  const rootsAmount = BigInt('10000000000000000000000'); // 10,000 ROOTS

  for (const wallet of TEST_WALLETS) {
    console.log(`--- Funding ${wallet.name} (${wallet.address}) ---`);

    // Check current balances
    const currentEth = await publicClient.getBalance({ address: wallet.address });
    const currentRoots = await publicClient.readContract({
      address: ROOTS_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address],
    });

    console.log('Current ETH:', formatEther(currentEth));
    console.log('Current ROOTS:', formatUnits(currentRoots, 18));

    // Note: Get ETH from faucet directly for each wallet
    if (currentEth === 0n) {
      console.log('⚠️  Needs ETH from faucet: https://www.coinbase.com/faucets/base-sepolia-faucet');
    }

    // Send ROOTS if needed
    if (currentRoots < rootsAmount) {
      console.log('Sending 10,000 ROOTS...');
      try {
        const rootsHash = await walletClient.writeContract({
          address: ROOTS_TOKEN,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [wallet.address, rootsAmount],
        });
        console.log('ROOTS tx:', rootsHash);
      } catch (e) {
        console.log('Error sending ROOTS:', e.shortMessage || e.message);
      }
    } else {
      console.log('ROOTS already sufficient');
    }

    console.log('');
  }

  console.log('Done! Wallets funded.');
}

main().catch(console.error);
