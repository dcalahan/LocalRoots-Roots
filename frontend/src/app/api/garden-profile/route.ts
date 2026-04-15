/**
 * POST /api/garden-profile  — opt in / update metadata
 * DELETE /api/garden-profile?userId=... — opt out
 *
 * NOTE: We trust the client-provided userId here because Privy auth happens
 * client-side. Server-side Privy verification can be added later if needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { encodeGeohash, reverseGeocodeWithNeighborhood, formatNeighborhoodDisplay } from '@/lib/geohashLocation';
import { upsertProfile, deleteProfile, getProfile } from '@/lib/gardenProfileStore';
import type { PublicGardenProfile } from '@/types/garden-profile';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const profile = await getProfile(userId);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  console.log('[garden-profile POST] request received');
  try {
    const body = await request.json();
    console.log('[garden-profile POST] body keys:', Object.keys(body));
    const {
      userId, displayName, bio, latitude, longitude,
      profilePhotoUrl, profilePhotoIpfs, gardenPhotoUrl, gardenPhotoIpfs,
    } = body as {
      userId?: string;
      displayName?: string;
      bio?: string;
      latitude?: number;
      longitude?: number;
      profilePhotoUrl?: string;
      profilePhotoIpfs?: string;
      gardenPhotoUrl?: string;
      gardenPhotoIpfs?: string;
    };

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!displayName?.trim()) return NextResponse.json({ error: 'displayName required' }, { status: 400 });

    const existing = await getProfile(userId);

    // Location is optional — user may deny GPS
    let geohash5 = existing?.geohash5 || '';
    let locationLabel = existing?.locationLabel || 'Location not shared';

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      geohash5 = encodeGeohash(latitude, longitude, 5);
      try {
        const neighborhood = await reverseGeocodeWithNeighborhood(latitude, longitude);
        locationLabel = formatNeighborhoodDisplay(neighborhood);
      } catch {
        locationLabel = 'Unknown area';
      }
    }

    const now = new Date().toISOString();
    const profile: PublicGardenProfile = {
      userId,
      displayName: displayName.trim().slice(0, 60),
      bio: bio?.trim().slice(0, 280) || undefined,
      geohash5,
      locationLabel,
      profilePhotoUrl: profilePhotoUrl || existing?.profilePhotoUrl,
      profilePhotoIpfs: profilePhotoIpfs || existing?.profilePhotoIpfs,
      gardenPhotoUrl: gardenPhotoUrl || existing?.gardenPhotoUrl,
      gardenPhotoIpfs: gardenPhotoIpfs || existing?.gardenPhotoIpfs,
      optedInAt: existing?.optedInAt || now,
      updatedAt: now,
    };

    await upsertProfile(profile);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[garden-profile POST] failed:', message, err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  try {
    await deleteProfile(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[garden-profile DELETE] failed:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
