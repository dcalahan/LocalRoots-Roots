/**
 * Geohash Location Decoder
 * Converts bytes8 geohash values to human-readable location information
 */

// Geohash base32 alphabet
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// Cache for reverse geocoding results
const geocodeCache = new Map<string, string>();

// Separate cache for neighborhood-level resolution (different zoom = different results)
const neighborhoodCache = new Map<string, NeighborhoodResult>();

export interface NeighborhoodResult {
  neighborhood: string | null;
  city: string;
  state: string;
}

// US state approximations based on 2-character geohash prefixes
// These are rough mappings - geohashes don't align perfectly with state boundaries
const GEOHASH_TO_STATE: Record<string, string> = {
  // Northeast
  'dr': 'New York / New Jersey',
  'dq': 'Pennsylvania / New York',
  'dp': 'Pennsylvania / Ohio',
  'dn': 'Ohio / West Virginia',

  // New England
  'dz': 'Connecticut / Massachusetts',
  'dy': 'Massachusetts / Rhode Island',
  'dx': 'Maine / New Hampshire',
  'dw': 'Vermont / New Hampshire',

  // Southeast
  'dj': 'South Carolina / Georgia',
  'dh': 'North Carolina / South Carolina',
  'dg': 'Georgia / Alabama',
  'df': 'Florida',

  // Mid-Atlantic
  'dc': 'Maryland / Delaware',
  'dd': 'Virginia',
  'de': 'North Carolina',

  // Midwest
  '9z': 'Illinois / Indiana',
  '9y': 'Indiana / Ohio',
  '9x': 'Michigan',
  '9w': 'Michigan',
  '9v': 'Wisconsin / Minnesota',
  '9u': 'Minnesota / Wisconsin',
  '9t': 'Minnesota / North Dakota',
  '9s': 'South Dakota / North Dakota',
  '9r': 'Nebraska / South Dakota',
  '9q': 'California',
  '9p': 'Nevada / California',
  '9n': 'Utah / Nevada',
  '9m': 'Colorado / Utah',

  // South Central
  '9g': 'Texas',
  '9f': 'Texas',
  '9e': 'Texas / Louisiana',
  '9d': 'Louisiana / Mississippi',
  '9c': 'Alabama / Mississippi',
  '9b': 'Georgia / Alabama',

  // Southwest
  '9h': 'Arizona / New Mexico',
  '9j': 'Arizona',
  '9k': 'Nevada / Arizona',

  // West Coast
  'c2': 'Washington',
  'c1': 'Oregon / Washington',
  'c0': 'Oregon / California',

  // Mountain
  'cb': 'Montana',
  'c8': 'Idaho / Montana',
  'c9': 'Montana / Wyoming',

  // Alaska
  'be': 'Alaska',
  'bf': 'Alaska',
  'bg': 'Alaska',
  'bd': 'Alaska',
  'bc': 'Alaska',
  'bb': 'Alaska',

  // Hawaii
  '8e': 'Hawaii',
  '8f': 'Hawaii',
  '87': 'Hawaii',
};

export interface GeohashLocation {
  latitude: number;
  longitude: number;
  approximateLocation: string;
  precision: number;
  geohashString: string;
}

/**
 * Decode a bytes8 geohash hex string to location information
 * @param geohashHex - The hex string from the contract (e.g., "0x646a710000000000")
 * @returns GeohashLocation with coordinates and approximate location name
 */
export function decodeGeohash(geohashHex: string): GeohashLocation {
  // Remove 0x prefix if present
  const hex = geohashHex.startsWith('0x') ? geohashHex.slice(2) : geohashHex;

  // Convert hex to string by treating each byte as ASCII
  let geohashString = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte === 0) break; // Stop at null terminator
    const char = String.fromCharCode(byte);
    if (BASE32.includes(char)) {
      geohashString += char;
    }
  }

  // Decode geohash to coordinates
  const { latitude, longitude } = geohashToLatLng(geohashString);

  // Get approximate location from 2-char prefix
  const prefix = geohashString.slice(0, 2).toLowerCase();
  const approximateLocation = GEOHASH_TO_STATE[prefix] || getRegionFromCoords(latitude, longitude);

  return {
    latitude,
    longitude,
    approximateLocation,
    precision: geohashString.length,
    geohashString,
  };
}

/**
 * Convert geohash string to latitude/longitude
 */
function geohashToLatLng(geohash: string): { latitude: number; longitude: number } {
  let isLon = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;

      if (isLon) {
        const mid = (lonMin + lonMax) / 2;
        if (bitValue === 1) {
          lonMin = mid;
        } else {
          lonMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitValue === 1) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLon = !isLon;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
  };
}

/**
 * Fallback: determine region from coordinates if geohash prefix not in map
 */
function getRegionFromCoords(lat: number, lng: number): string {
  // Very rough US region determination
  if (lat < 25 || lat > 50 || lng < -130 || lng > -65) {
    return 'Unknown Location';
  }

  if (lng > -80) {
    if (lat > 40) return 'Northeast US';
    return 'Southeast US';
  } else if (lng > -100) {
    if (lat > 40) return 'Midwest US';
    return 'South Central US';
  } else if (lng > -115) {
    if (lat > 40) return 'Mountain West US';
    return 'Southwest US';
  } else {
    return 'Pacific West US';
  }
}

/**
 * Format coordinates as a string
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lng).toFixed(4)}${lngDir}`;
}

/**
 * Encode latitude/longitude to a geohash string
 * @param lat - Latitude
 * @param lng - Longitude
 * @param precision - Number of characters (default 6)
 * @returns Geohash string
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let isLon = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let geohash = '';
  let bits = 0;
  let idx = 0;

  while (geohash.length < precision) {
    if (isLon) {
      const mid = (lonMin + lonMax) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lonMin = mid;
      } else {
        idx = idx * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    isLon = !isLon;

    bits++;
    if (bits === 5) {
      geohash += BASE32[idx];
      bits = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Convert geohash string to bytes8 hex for contract calls
 * @param geohash - Geohash string
 * @returns Hex string like "0x646a710000000000"
 */
export function geohashToBytes8(geohash: string): `0x${string}` {
  let hex = '0x';
  for (let i = 0; i < 8; i++) {
    if (i < geohash.length) {
      hex += geohash.charCodeAt(i).toString(16).padStart(2, '0');
    } else {
      hex += '00';
    }
  }
  return hex as `0x${string}`;
}

/**
 * Reverse geocode coordinates to get a human-readable location name
 * Uses OpenStreetMap Nominatim API (free, global coverage)
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Location name like "Hilton Head Island, SC" or fallback to coordinates
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Create cache key with reduced precision to group nearby locations
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'LocalRoots-Marketplace/1.0 (https://localroots.app)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract meaningful location parts
    const address = data.address || {};
    const parts: string[] = [];

    // Try to get city/town/village name
    const locality = address.city || address.town || address.village || address.hamlet || address.municipality;
    if (locality) {
      parts.push(locality);
    }

    // Add state/province for US, or country for international
    if (address.state) {
      // Use state abbreviation for US states if available
      const stateAbbrev = getUSStateAbbreviation(address.state);
      parts.push(stateAbbrev || address.state);
    } else if (address.country && !locality) {
      parts.push(address.country);
    }

    const result = parts.length > 0 ? parts.join(', ') : formatCoordinates(lat, lng);

    // Cache the result
    geocodeCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('[reverseGeocode] Error:', error);
    // Fallback to coordinates on error
    const fallback = formatCoordinates(lat, lng);
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Get US state abbreviation from full name
 */
function getUSStateAbbreviation(stateName: string): string | null {
  const abbreviations: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  };
  return abbreviations[stateName] || null;
}

/**
 * Reverse geocode coordinates to get neighborhood-level location
 * Uses Nominatim zoom=18 for granular results (neighbourhood, suburb, city_district)
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns NeighborhoodResult with neighborhood name (if available), city, and state
 */
export async function reverseGeocodeWithNeighborhood(lat: number, lng: number): Promise<NeighborhoodResult> {
  // Cache key using geohash prefix (4 chars ≈ same neighborhood)
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

  if (neighborhoodCache.has(cacheKey)) {
    return neighborhoodCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LocalRoots-Marketplace/1.0 (https://localroots.love)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};

    // Priority chain for neighborhood name
    const neighborhood = address.neighbourhood || address.suburb || address.city_district || null;
    const city = address.city || address.town || address.village || address.hamlet || address.municipality || '';
    const stateName = address.state || '';
    const stateAbbrev = getUSStateAbbreviation(stateName) || stateName;

    const result: NeighborhoodResult = {
      neighborhood,
      city,
      state: stateAbbrev,
    };

    neighborhoodCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[reverseGeocodeWithNeighborhood] Error:', error);
    const fallback: NeighborhoodResult = { neighborhood: null, city: '', state: '' };
    neighborhoodCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Format neighborhood result for display
 * Returns "Haynes Manor, Atlanta" or "Atlanta, GA" or "GA" as fallback
 */
export function formatNeighborhoodDisplay(result: NeighborhoodResult): string {
  if (result.neighborhood && result.city) {
    return `${result.neighborhood}, ${result.city}`;
  }
  if (result.neighborhood) {
    return result.neighborhood;
  }
  if (result.city && result.state) {
    return `${result.city}, ${result.state}`;
  }
  return result.city || result.state || '';
}

/**
 * Decode geohash and get reverse-geocoded location name
 * @param geohashHex - The hex string from the contract
 * @returns Promise with location name
 */
export async function getLocationFromGeohash(geohashHex: string): Promise<string> {
  const location = decodeGeohash(geohashHex);
  return reverseGeocode(location.latitude, location.longitude);
}
