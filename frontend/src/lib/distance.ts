// Distance unit utilities

export type DistanceUnit = 'km' | 'miles';

// Countries that use miles (US, UK, Myanmar, Liberia)
const MILES_COUNTRIES = ['US', 'GB', 'MM', 'LR'];

/**
 * Detect preferred distance unit based on browser locale
 */
export function getPreferredDistanceUnit(): DistanceUnit {
  if (typeof navigator === 'undefined') return 'km';

  // Try to get country from locale
  const locale = navigator.language || 'en-US';
  const parts = locale.split('-');
  const country = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();

  return MILES_COUNTRIES.includes(country) ? 'miles' : 'km';
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Convert miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Format distance for display
 */
export function formatDistance(km: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = kmToMiles(km);
    return `${miles.toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Convert display value to km for storage
 */
export function toKm(value: number, unit: DistanceUnit): number {
  return unit === 'miles' ? milesToKm(value) : value;
}

/**
 * Convert km from storage to display value
 */
export function fromKm(km: number, unit: DistanceUnit): number {
  return unit === 'miles' ? kmToMiles(km) : km;
}

/**
 * Get unit label
 */
export function getUnitLabel(unit: DistanceUnit): string {
  return unit === 'miles' ? 'miles' : 'km';
}

/**
 * Get short unit label
 */
export function getShortUnitLabel(unit: DistanceUnit): string {
  return unit === 'miles' ? 'mi' : 'km';
}
