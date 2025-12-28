/**
 * IPFS-related types for metadata schemas
 */

/**
 * Base IPFS metadata with timestamps
 */
export interface BaseMetadata {
  createdAt: string; // ISO date
  updatedAt?: string; // ISO date
}

/**
 * IPFS upload response
 */
export interface IpfsUploadResult {
  ipfsHash: string;
  url: string;
}

/**
 * Image metadata for IPFS-stored images
 */
export interface ImageMetadata {
  ipfsHash: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

/**
 * IPFS gateway URL builder
 */
export function buildIpfsUrl(
  hash: string,
  gateway: string = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'gateway.pinata.cloud'
): string {
  // Handle ipfs:// protocol
  if (hash.startsWith('ipfs://')) {
    hash = hash.replace('ipfs://', '');
  }
  // Handle full URLs
  if (hash.startsWith('http')) {
    return hash;
  }
  return `https://${gateway}/ipfs/${hash}`;
}

/**
 * Validate IPFS hash format (CIDv0 or CIDv1)
 */
export function isValidIpfsHash(hash: string): boolean {
  // Remove protocol if present
  if (hash.startsWith('ipfs://')) {
    hash = hash.replace('ipfs://', '');
  }

  // CIDv0: starts with Qm, 46 chars
  if (hash.startsWith('Qm') && hash.length === 46) {
    return true;
  }

  // CIDv1: starts with bafy (or other bases), variable length
  if (hash.startsWith('bafy') && hash.length > 50) {
    return true;
  }

  return false;
}
