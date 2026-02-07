import { PinataSDK } from 'pinata';

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});

export interface UploadResult {
  ipfsHash: string;
  url: string;
}

/**
 * Upload an image file to IPFS via Pinata
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const upload = await pinata.upload.public.file(file);
  return {
    ipfsHash: upload.cid,
    url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.cid}`,
  };
}

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export async function uploadMetadata(
  metadata: Record<string, unknown>,
  name?: string
): Promise<UploadResult> {
  console.log('[Pinata] Uploading metadata:', { name, metadataKeys: Object.keys(metadata) });
  try {
    const upload = await pinata.upload.public.json(metadata).name(name || 'metadata.json');
    console.log('[Pinata] Upload success, CID:', upload.cid);
    return {
      ipfsHash: upload.cid,
      url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.cid}`,
    };
  } catch (err) {
    console.error('[Pinata] Upload failed:', err);
    throw err;
  }
}

/**
 * Get the gateway URL for an IPFS hash
 * Uses ipfs.io as default since Pinata public gateway has aggressive rate limits
 */
export function getIpfsUrl(ipfsHash: string): string {
  if (!ipfsHash) return '';

  if (ipfsHash.startsWith('ipfs://')) {
    ipfsHash = ipfsHash.replace('ipfs://', '');
  }

  // Use ipfs.io for reads (more permissive rate limits than Pinata public gateway)
  // Pinata gateway is rate-limited and has Cloudflare bot protection
  return `https://ipfs.io/ipfs/${ipfsHash}`;
}

export { pinata };
