import ngeohash from 'ngeohash';
import { type Hex } from 'viem';

/**
 * Encode latitude/longitude to an 8-character geohash string
 * 8 chars gives ~19m x 19m precision
 */
export function encodeLocation(latitude: number, longitude: number): string {
  return ngeohash.encode(latitude, longitude, 8);
}

// Alias for compatibility
export const encodeGeohash = encodeLocation;

/**
 * Decode a geohash string back to latitude/longitude
 */
export function decodeGeohash(geohash: string): { latitude: number; longitude: number } {
  const decoded = ngeohash.decode(geohash);
  return {
    latitude: decoded.latitude,
    longitude: decoded.longitude,
  };
}

/**
 * Convert a geohash string to bytes8 for smart contract calls
 * Pads with null bytes if the geohash is less than 8 characters
 */
export function geohashToBytes8(geohash: string): Hex {
  // Ensure 8 characters, pad with null bytes if needed
  const padded = geohash.padEnd(8, '\0');

  // Convert to hex bytes
  let hex = '0x';
  for (let i = 0; i < 8; i++) {
    hex += padded.charCodeAt(i).toString(16).padStart(2, '0');
  }

  return hex as Hex;
}

/**
 * Convert bytes8 from contract back to geohash string
 */
export function bytes8ToGeohash(bytes8: Hex): string {
  // Remove 0x prefix
  const hex = bytes8.slice(2);

  let geohash = '';
  for (let i = 0; i < 16; i += 2) {
    const charCode = parseInt(hex.slice(i, i + 2), 16);
    if (charCode === 0) break; // Stop at null byte
    geohash += String.fromCharCode(charCode);
  }

  return geohash;
}

/**
 * Get geohash prefixes for different precision levels
 * Used for location-based seller queries
 */
export function getGeohashPrefixes(geohash: string): {
  city: string;      // 4 chars (~20km)
  neighborhood: string; // 5 chars (~5km)
  block: string;     // 6 chars (~1km)
} {
  return {
    city: geohash.slice(0, 4),
    neighborhood: geohash.slice(0, 5),
    block: geohash.slice(0, 6),
  };
}

/**
 * Calculate approximate distance between two geohashes (very rough estimate)
 * For display purposes only, not for precise calculations
 */
export function approximateDistance(geohash1: string, geohash2: string): number {
  const pos1 = decodeGeohash(geohash1);
  const pos2 = decodeGeohash(geohash2);

  // Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = toRad(pos2.latitude - pos1.latitude);
  const dLon = toRad(pos2.longitude - pos1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(pos1.latitude)) *
      Math.cos(toRad(pos2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
