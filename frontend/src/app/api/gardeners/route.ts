/**
 * GET /api/gardeners?geohash5=xxxxx&prefix=2
 *
 * Returns the list of opted-in gardeners. Optional query params:
 *   geohash5 — center cell to sort by proximity
 *   prefix   — only return profiles whose geohash5 starts with this string
 */

import { NextRequest, NextResponse } from 'next/server';
import { listOptedInUserIds, getProfile, buildProfileView } from '@/lib/gardenProfileStore';

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix') || '';
  const center = request.nextUrl.searchParams.get('geohash5') || '';

  try {
    const ids = await listOptedInUserIds();
    const profiles = await Promise.all(ids.map(id => getProfile(id)));

    let filtered = profiles.filter((p): p is NonNullable<typeof p> => !!p);
    if (prefix) filtered = filtered.filter(p => p.geohash5.startsWith(prefix));

    // Crude proximity sort: longer shared prefix with `center` first.
    if (center) {
      filtered.sort((a, b) => {
        const sharedA = sharedPrefixLength(a.geohash5, center);
        const sharedB = sharedPrefixLength(b.geohash5, center);
        return sharedB - sharedA;
      });
    }

    const views = await Promise.all(filtered.map(p => buildProfileView(p)));
    return NextResponse.json({ gardeners: views });
  } catch (err) {
    console.error('[gardeners GET] failed:', err);
    return NextResponse.json({ gardeners: [] });
  }
}

function sharedPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
