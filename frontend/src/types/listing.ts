/**
 * On-chain listing data from the smart contract
 */
export interface Listing {
  id: bigint;
  sellerId: bigint;
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: bigint;
  active: boolean;
}

/**
 * Listing metadata stored on IPFS
 */
export interface ListingMetadata {
  // Produce info (from seed data)
  produceId: string;
  produceName: string;
  category: string;

  // Listing details
  description?: string;
  unitId: string; // e.g., 'lb', 'each', 'bunch'
  unitName: string;

  // Images
  images: string[]; // IPFS hashes

  // Optional info
  organic?: boolean;
  growingPractices?: string;
  harvestDate?: string; // ISO date

  // Timestamps
  createdAt: string; // ISO date
  updatedAt?: string; // ISO date
}

/**
 * Form data for creating a listing
 */
export interface CreateListingForm {
  // Produce selection
  produceId: string;

  // Listing details
  description?: string;
  pricePerUnit: string; // String for form input (converted to wei)
  quantity: number;
  unitId: string;

  // Images
  images: File[];

  // Optional info
  organic?: boolean;
  growingPractices?: string;
}

/**
 * Combined listing data (on-chain + IPFS metadata)
 */
export interface ListingWithMetadata extends Listing {
  metadata?: ListingMetadata;
}

/**
 * Price formatting helpers
 */
export function formatPrice(priceWei: bigint): string {
  // Convert wei to ETH-like display (6 decimals for USDC/stablecoins)
  const price = Number(priceWei) / 1e6;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

export function parsePriceToWei(priceString: string): bigint {
  // Convert dollar string to 6-decimal wei
  const price = parseFloat(priceString);
  return BigInt(Math.round(price * 1e6));
}
