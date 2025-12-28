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
  const upload = await pinata.upload.public.json(metadata).name(name || 'metadata.json');
  return {
    ipfsHash: upload.cid,
    url: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${upload.cid}`,
  };
}

/**
 * Get the gateway URL for an IPFS hash
 */
export function getIpfsUrl(ipfsHash: string): string {
  if (ipfsHash.startsWith('ipfs://')) {
    ipfsHash = ipfsHash.replace('ipfs://', '');
  }
  return `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${ipfsHash}`;
}

export { pinata };
