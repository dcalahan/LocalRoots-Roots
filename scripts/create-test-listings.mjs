#!/usr/bin/env node
/**
 * Script to create test listings on Base Sepolia
 * Usage: PINATA_JWT=your_jwt node scripts/create-test-listings.mjs
 */

import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Contract addresses
const MARKETPLACE_ADDRESS = '0x284cC27FAE9c48CDC679BDb03Ac1d3dE691EA802';

// ABI for the functions we need
const marketplaceAbi = [
  {
    type: 'function',
    name: 'registerSeller',
    inputs: [
      { name: '_geohash', type: 'bytes8' },
      { name: '_storefrontIpfs', type: 'string' },
      { name: '_offersDelivery', type: 'bool' },
      { name: '_offersPickup', type: 'bool' },
      { name: '_deliveryRadiusKm', type: 'uint256' },
    ],
    outputs: [{ name: 'sellerId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createListing',
    inputs: [
      { name: '_metadataIpfs', type: 'string' },
      { name: '_pricePerUnit', type: 'uint256' },
      { name: '_quantityAvailable', type: 'uint256' },
    ],
    outputs: [{ name: 'listingId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSeller',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextListingId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

// Geohash for 29928 (Hilton Head Island, SC)
const GEOHASH_BYTES8 = '0x646a777836327663'; // djwx62vc

// Test metadata (will be uploaded to IPFS)
const sellerMetadata = {
  name: 'Hilton Head Garden',
  description: 'Fresh organic vegetables from my backyard garden in Hilton Head Island. Growing tomatoes, peppers, and herbs year-round.',
  imageUrl: null,
};

const listings = [
  {
    metadata: {
      produceName: 'Heirloom Tomatoes',
      description: 'Freshly picked Cherokee Purple and Brandywine heirloom tomatoes. Organically grown, no pesticides.',
      imageUrl: null,
      unit: 'lb',
      category: 'vegetables',
    },
    pricePerUnit: parseEther('5'), // 5 ROOTS per lb
    quantity: 20,
  },
  {
    metadata: {
      produceName: 'Bell Peppers',
      description: 'Mix of red, yellow, and green bell peppers. Sweet and crunchy, perfect for salads or cooking.',
      imageUrl: null,
      unit: 'each',
      category: 'vegetables',
    },
    pricePerUnit: parseEther('2'), // 2 ROOTS each
    quantity: 30,
  },
  {
    metadata: {
      produceName: 'Fresh Basil',
      description: 'Aromatic Genovese basil, freshly cut. Great for pesto, caprese, or Italian dishes.',
      imageUrl: null,
      unit: 'bunch',
      category: 'herbs',
    },
    pricePerUnit: parseEther('3'), // 3 ROOTS per bunch
    quantity: 15,
  },
];

async function uploadToIPFS(data, pinataJwt) {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: data.produceName || data.name || 'metadata',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

async function main() {
  const pinataJwt = process.env.PINATA_JWT;
  const privateKey = process.env.PRIVATE_KEY || '0x230a5604a90c138dfd766fa341ab85edbf1a0383f5b27f82886b51b79aabe282';

  if (!pinataJwt) {
    console.error('Error: PINATA_JWT environment variable is required');
    console.error('Get your JWT at https://app.pinata.cloud/developers/api-keys');
    console.error('Usage: PINATA_JWT=your_jwt node scripts/create-test-listings.mjs');
    process.exit(1);
  }

  console.log('Creating test listings for zip 29928 (Hilton Head Island)...\n');

  // Setup clients
  const account = privateKeyToAccount(privateKey);
  console.log(`Using wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  });

  // Check if already a seller
  const isSeller = await publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'isSeller',
    args: [account.address],
  });

  if (!isSeller) {
    console.log('Registering as seller...');

    // Upload seller metadata to IPFS
    console.log('Uploading seller metadata to IPFS...');
    const sellerIpfsHash = await uploadToIPFS(sellerMetadata, pinataJwt);
    console.log(`Seller metadata IPFS: ${sellerIpfsHash}`);

    // Register seller
    const registerHash = await walletClient.writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'registerSeller',
      args: [
        GEOHASH_BYTES8,
        sellerIpfsHash,
        true, // offers delivery
        true, // offers pickup
        10n,  // 10km delivery radius
      ],
    });

    console.log(`Register seller tx: ${registerHash}`);
    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log(`Seller registered in block ${registerReceipt.blockNumber}\n`);
  } else {
    console.log('Already registered as seller\n');
  }

  // Create listings
  for (const listing of listings) {
    console.log(`Creating listing: ${listing.metadata.produceName}...`);

    // Upload listing metadata to IPFS
    const ipfsHash = await uploadToIPFS(listing.metadata, pinataJwt);
    console.log(`  IPFS hash: ${ipfsHash}`);

    // Create listing on contract
    const createHash = await walletClient.writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'createListing',
      args: [ipfsHash, listing.pricePerUnit, BigInt(listing.quantity)],
    });

    console.log(`  Tx hash: ${createHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log(`  Created in block ${receipt.blockNumber}\n`);
  }

  // Verify listings
  const nextListingId = await publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'nextListingId',
  });

  console.log(`\nDone! Total listings on contract: ${Number(nextListingId) - 1}`);
  console.log('View at http://localhost:3000/buy');
}

main().catch(console.error);
