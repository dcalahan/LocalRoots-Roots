/**
 * Public Garden Profile — opt-in directory of gardeners by area.
 *
 * Privacy rules (non-negotiable):
 * - Default OFF. Users must explicitly opt in.
 * - Geohash precision = 5 chars max (~5km cell). Never store exact coords.
 * - Never expose plant quantities, harvest dates, personal notes, or contact info.
 * - Distilled `currentlyGrowing` is computed on read from the existing my-garden blob.
 */

import type { GardenBed, PlantStatus } from './my-garden';

export interface PublicGardenProfile {
  userId: string;            // Privy user id
  displayName: string;
  bio?: string;
  geohash5: string;          // 5-char precision (~5km × 5km cell)
  locationLabel: string;     // "Hilton Head, SC" — reverse geocoded
  profilePhotoUrl?: string;  // selfie / avatar
  profilePhotoIpfs?: string; // IPFS CID
  gardenPhotoUrl?: string;   // overall garden photo
  gardenPhotoIpfs?: string;  // IPFS CID
  optedInAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
}

/** What a public profile looks like when distilled with garden state on read. */
export interface PublicGardenProfileView extends PublicGardenProfile {
  beds: GardenBed[];
  currentlyGrowing: {
    cropId: string;
    cropName: string;
    bedName?: string;
    status: PlantStatus;
  }[];
}
