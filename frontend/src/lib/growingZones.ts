/**
 * Growing Zones Utilities
 * Determines hardiness zones and frost dates from location data
 */

import growingZonesData from '../../../data/growing-zones.json';
import { decodeGeohash, encodeGeohash } from './geohashLocation';

// Types
export interface GrowingProfile {
  zone: string;
  lastSpringFrost: Date;
  firstFallFrost: Date;
  growingSeasonDays: number;
  isTropical: boolean;
  isSouthernHemisphere: boolean;
  wetSeasonStart?: number; // month 1-12 for tropical
  wetSeasonEnd?: number;
  confidence: 'precise' | 'estimated' | 'manual';
  latitude: number;
  longitude: number;
}

export interface ZoneData {
  lastSpringFrost: string | null; // MM-DD format, null for frost-free zones
  firstFallFrost: string | null;
  growingSeasonDays: number;
  frostFree?: boolean;
}

interface GeohashZoneData {
  zone: string;
  region: string;
}

interface LatitudeZoneData {
  minLat: number;
  maxLat: number;
  defaultZone: string;
  description: string;
  isTropical?: boolean;
}

interface TropicalSeasonData {
  wetSeasonStart: number;
  wetSeasonEnd: number;
  description: string;
}

// Type assertions for imported JSON
const zoneData = growingZonesData.zoneData as Record<string, ZoneData>;
const usCanadaZones = growingZonesData.usCanadaZones as Record<string, GeohashZoneData>;
const latitudeZones = growingZonesData.latitudeZones as LatitudeZoneData[];
const tropicalSeasons = growingZonesData.tropicalSeasons as Record<string, TropicalSeasonData>;

/**
 * Get growing profile from geohash hex string (from blockchain)
 */
export function getGrowingProfileFromGeohash(geohashHex: string, year?: number): GrowingProfile {
  const { latitude, longitude, geohashString } = decodeGeohash(geohashHex);
  return getGrowingProfile(latitude, longitude, geohashString, year);
}

/**
 * Get growing profile from lat/lng coordinates
 */
export function getGrowingProfile(
  lat: number,
  lng: number,
  geohashString?: string,
  year?: number
): GrowingProfile {
  const currentYear = year || new Date().getFullYear();
  const isSouthernHemisphere = lat < 0;
  const isTropical = isInTropicalRegion(lat);

  // Get zone - try precise lookup first, then fall back to estimation
  const { zone, confidence } = getZoneFromCoordinates(lat, lng, geohashString);

  // Get frost dates for this zone
  const frostDates = getFrostDates(zone, currentYear, isSouthernHemisphere);

  // Get tropical season info if applicable
  let wetSeasonStart: number | undefined;
  let wetSeasonEnd: number | undefined;

  if (isTropical) {
    const tropicalInfo = getTropicalSeasons(lat, lng);
    wetSeasonStart = tropicalInfo?.wetSeasonStart;
    wetSeasonEnd = tropicalInfo?.wetSeasonEnd;
  }

  return {
    zone,
    lastSpringFrost: frostDates.lastSpring,
    firstFallFrost: frostDates.firstFall,
    growingSeasonDays: frostDates.seasonDays,
    isTropical,
    isSouthernHemisphere,
    wetSeasonStart,
    wetSeasonEnd,
    confidence,
    latitude: lat,
    longitude: lng,
  };
}

/**
 * Get zone from coordinates - tries precise lookup first
 */
export function getZoneFromCoordinates(
  lat: number,
  lng: number,
  geohashString?: string
): { zone: string; confidence: 'precise' | 'estimated' } {
  // Generate geohash if not provided
  const geohash = geohashString || encodeGeohash(lat, lng, 6);

  // Try 3-character prefix lookup (most precise for US/Canada)
  const prefix3 = geohash.slice(0, 3).toLowerCase();
  if (usCanadaZones[prefix3]) {
    return { zone: usCanadaZones[prefix3].zone, confidence: 'precise' };
  }

  // Try 2-character prefix (less precise but still good)
  const prefix2 = geohash.slice(0, 2).toLowerCase();
  const matchingKeys = Object.keys(usCanadaZones).filter(k => k.startsWith(prefix2));
  if (matchingKeys.length > 0) {
    // Use the first match as an approximation
    return { zone: usCanadaZones[matchingKeys[0]].zone, confidence: 'estimated' };
  }

  // Fall back to latitude-based estimation
  const latZone = getZoneFromLatitude(lat);
  return { zone: latZone, confidence: 'estimated' };
}

/**
 * Get zone based on latitude alone (global fallback)
 */
function getZoneFromLatitude(lat: number): string {
  const absLat = Math.abs(lat);

  for (const band of latitudeZones) {
    if (absLat >= band.minLat && absLat < band.maxLat) {
      return band.defaultZone;
    }
  }

  // Default fallbacks
  if (absLat < 10) return '13a'; // Tropical
  if (absLat > 60) return '2a'; // Very cold
  return '6a'; // Moderate default
}

/**
 * Check if location is in tropical region (no frost)
 */
export function isInTropicalRegion(lat: number): boolean {
  return Math.abs(lat) <= 23.5;
}

/**
 * Get frost dates for a zone, adjusted for hemisphere
 */
export function getFrostDates(
  zone: string,
  year: number,
  isSouthernHemisphere: boolean = false
): { lastSpring: Date; firstFall: Date; seasonDays: number } {
  // Get zone data, falling back to zone number without letter
  let zData = zoneData[zone];
  if (!zData) {
    // Try just the zone number (e.g., "7" instead of "7a")
    const zoneNum = zone.replace(/[ab]$/, '');
    zData = zoneData[`${zoneNum}a`] || zoneData[`${zoneNum}b`];
  }

  // Default fallback
  if (!zData) {
    zData = { lastSpringFrost: '04-15', firstFallFrost: '10-15', growingSeasonDays: 180 };
  }

  // Handle frost-free zones (null frost dates)
  if (!zData.lastSpringFrost || !zData.firstFallFrost) {
    // Frost-free zone - use year-round growing season
    return {
      lastSpring: new Date(year, 0, 1), // Jan 1
      firstFall: new Date(year, 11, 31), // Dec 31
      seasonDays: 365,
    };
  }

  // Parse dates
  const [springMonth, springDay] = zData.lastSpringFrost.split('-').map(Number);
  const [fallMonth, fallDay] = zData.firstFallFrost.split('-').map(Number);

  let lastSpring: Date;
  let firstFall: Date;

  if (isSouthernHemisphere) {
    // Southern hemisphere: swap seasons and add 6 months
    // Their "spring" (planting season) is our fall, and vice versa
    // Spring frost in southern hemisphere is around September-October
    // Fall frost is around March-April
    const adjustedSpringMonth = ((springMonth + 5) % 12) + 1;
    const adjustedFallMonth = ((fallMonth + 5) % 12) + 1;

    lastSpring = new Date(year, adjustedSpringMonth - 1, springDay);
    firstFall = new Date(year, adjustedFallMonth - 1, fallDay);

    // If fall comes before spring chronologically, adjust year
    if (firstFall < lastSpring) {
      firstFall = new Date(year + 1, adjustedFallMonth - 1, fallDay);
    }
  } else {
    lastSpring = new Date(year, springMonth - 1, springDay);
    firstFall = new Date(year, fallMonth - 1, fallDay);
  }

  return {
    lastSpring,
    firstFall,
    seasonDays: zData.growingSeasonDays,
  };
}

/**
 * Get tropical wet/dry season info
 */
function getTropicalSeasons(lat: number, lng: number): TropicalSeasonData | null {
  // Simplified: Northern tropical regions typically have wet season June-October
  // Southern tropical regions typically have wet season November-March
  if (lat >= 0) {
    return tropicalSeasons.northernTropics || {
      wetSeasonStart: 6,
      wetSeasonEnd: 10,
      description: 'Wet season June-October',
    };
  } else {
    return tropicalSeasons.southernTropics || {
      wetSeasonStart: 11,
      wetSeasonEnd: 3,
      description: 'Wet season November-March',
    };
  }
}

/**
 * Format frost date for display
 */
export function formatFrostDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/**
 * Get zone description (e.g., "Zone 7a: -5 to 0°F")
 */
export function getZoneDescription(zone: string): string {
  const zoneTemps: Record<string, string> = {
    '1a': '-60 to -55°F', '1b': '-55 to -50°F',
    '2a': '-50 to -45°F', '2b': '-45 to -40°F',
    '3a': '-40 to -35°F', '3b': '-35 to -30°F',
    '4a': '-30 to -25°F', '4b': '-25 to -20°F',
    '5a': '-20 to -15°F', '5b': '-15 to -10°F',
    '6a': '-10 to -5°F', '6b': '-5 to 0°F',
    '7a': '0 to 5°F', '7b': '5 to 10°F',
    '8a': '10 to 15°F', '8b': '15 to 20°F',
    '9a': '20 to 25°F', '9b': '25 to 30°F',
    '10a': '30 to 35°F', '10b': '35 to 40°F',
    '11a': '40 to 45°F', '11b': '45 to 50°F',
    '12a': '50 to 55°F', '12b': '55 to 60°F',
    '13a': '60 to 65°F', '13b': '65 to 70°F',
  };

  const temp = zoneTemps[zone] || 'Unknown';
  return `Zone ${zone}: ${temp}`;
}

/**
 * Calculate a date relative to frost date
 */
export function calculatePlantingDate(
  frostDate: Date,
  weeksOffset: number,
  isBefore: boolean = true
): Date {
  const result = new Date(frostDate);
  const daysOffset = weeksOffset * 7;

  if (isBefore) {
    result.setDate(result.getDate() - daysOffset);
  } else {
    result.setDate(result.getDate() + daysOffset);
  }

  return result;
}

/**
 * Check if a date falls within the growing season
 */
export function isInGrowingSeason(
  date: Date,
  profile: GrowingProfile
): boolean {
  if (profile.isTropical) {
    return true; // Year-round growing in tropics
  }

  return date >= profile.lastSpringFrost && date <= profile.firstFallFrost;
}

/**
 * Get current month's growing status
 */
export function getSeasonStatus(profile: GrowingProfile): 'pre-season' | 'growing' | 'post-season' | 'year-round' {
  if (profile.isTropical) {
    return 'year-round';
  }

  const now = new Date();

  if (now < profile.lastSpringFrost) {
    return 'pre-season';
  } else if (now > profile.firstFallFrost) {
    return 'post-season';
  } else {
    return 'growing';
  }
}

/**
 * Apply manual overrides to a growing profile
 */
export function applyManualOverrides(
  profile: GrowingProfile,
  overrides: {
    zone?: string;
    lastSpringFrost?: Date;
    firstFallFrost?: Date;
  }
): GrowingProfile {
  const updated = { ...profile, confidence: 'manual' as const };

  if (overrides.zone) {
    updated.zone = overrides.zone;
    // Recalculate frost dates for new zone if not explicitly overridden
    if (!overrides.lastSpringFrost || !overrides.firstFallFrost) {
      const year = profile.lastSpringFrost.getFullYear();
      const frostDates = getFrostDates(overrides.zone, year, profile.isSouthernHemisphere);
      if (!overrides.lastSpringFrost) updated.lastSpringFrost = frostDates.lastSpring;
      if (!overrides.firstFallFrost) updated.firstFallFrost = frostDates.firstFall;
      updated.growingSeasonDays = frostDates.seasonDays;
    }
  }

  if (overrides.lastSpringFrost) {
    updated.lastSpringFrost = overrides.lastSpringFrost;
  }

  if (overrides.firstFallFrost) {
    updated.firstFallFrost = overrides.firstFallFrost;
  }

  // Recalculate season days if dates were manually set
  if (overrides.lastSpringFrost || overrides.firstFallFrost) {
    const diffTime = updated.firstFallFrost.getTime() - updated.lastSpringFrost.getTime();
    updated.growingSeasonDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  return updated;
}

/**
 * Get all available zones for manual selection
 */
export function getAllZones(): Array<{ zone: string; description: string }> {
  const zones: Array<{ zone: string; description: string }> = [];

  for (let num = 1; num <= 13; num++) {
    zones.push({ zone: `${num}a`, description: getZoneDescription(`${num}a`) });
    zones.push({ zone: `${num}b`, description: getZoneDescription(`${num}b`) });
  }

  return zones;
}
