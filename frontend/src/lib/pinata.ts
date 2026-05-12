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

/**
 * Fetch JSON from IPFS by CID. Races ipfs.io + Pinata gateways so a
 * single-gateway slowdown (Pinata public gateway routinely takes 4–7s
 * for cold-cache reads) doesn't blank the UI. Returns the parsed JSON
 * (as a generic record) or null on timeout / both gateways failing.
 *
 * Accepts a bare CID, `ipfs://CID`, or already-extracted hash. Does
 * NOT handle `data:application/json,` URIs or test fixtures — call
 * sites should branch on those formats before calling this.
 *
 * Default timeout: 5s. Pinata cold reads have been measured at 4–7s
 * on the public free-tier gateway, while ipfs.io serves the same CIDs
 * in ~150ms — so most requests will race ipfs.io's response and
 * abort the Pinata fetch as soon as ipfs.io completes.
 *
 * Used by every listing/seller/order surface that reads IPFS
 * metadata. Centralizing here keeps gateway choice + timeout
 * consistent across buyer and seller views (see CLAUDE.md
 * "Buyer/Seller Parity").
 */
export async function fetchIpfsJson(
  cidOrUri: string,
  timeoutMs = 5000,
): Promise<Record<string, unknown> | null> {
  if (!cidOrUri) return null;
  const cid = cidOrUri.startsWith('ipfs://') ? cidOrUri.slice(7) : cidOrUri;
  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await Promise.any(
      gateways.map(async (url) => {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      }),
    );
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export { pinata };
