/**
 * POST /api/gardener-profile  — opt in / update metadata
 * DELETE /api/gardener-profile?userId=... — opt out
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import type { PublicGardenProfile } from '@/types/garden-profile';

const PROFILE_KEY = (userId: string) => `garden-profile:${userId}`;
const INDEX_KEY = 'garden-profile-index';

async function getProfile(userId: string): Promise<PublicGardenProfile | null> {
  return await kv.get<PublicGardenProfile>(PROFILE_KEY(userId));
}

async function upsertProfile(profile: PublicGardenProfile): Promise<void> {
  await kv.set(PROFILE_KEY(profile.userId), profile);
  const ids = await kv.get<string[]>(INDEX_KEY) || [];
  if (!Array.isArray(ids)) return;
  if (!ids.includes(profile.userId)) {
    ids.push(profile.userId);
    await kv.set(INDEX_KEY, ids);
  }
}

async function hideProfile(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) return;
  profile.hidden = true;
  profile.updatedAt = new Date().toISOString();
  await kv.set(PROFILE_KEY(userId), profile);
  // Remove from public index
  const ids = await kv.get<string[]>(INDEX_KEY) || [];
  if (!Array.isArray(ids)) return;
  const next = ids.filter(id => id !== userId);
  if (next.length !== ids.length) await kv.set(INDEX_KEY, next);
}

// Simple geohash encoder (inline to avoid import chain issues)
function encodeGeohash(lat: number, lng: number, precision: number = 5): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0, bit = 0, evenBit = true;
  let hash = '';
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; }
      else { idx = idx * 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; }
      else { idx = idx * 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { 'User-Agent': 'LocalRoots-Marketplace/1.0 (https://localroots.love)' } }
    );
    if (!res.ok) return 'Unknown area';
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || '';
    const state = addr.state || '';
    return city && state ? `${city}, ${state}` : city || state || 'Unknown area';
  } catch {
    return 'Unknown area';
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  try {
    const profile = await getProfile(userId);
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[garden-profile GET] failed:', message);
    return NextResponse.json({ error: `Load failed: ${message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    let geohash5 = existing?.geohash5 || '';
    let locationLabel = existing?.locationLabel || 'Location not shared';

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      geohash5 = encodeGeohash(latitude, longitude, 5);
      locationLabel = await reverseGeocode(latitude, longitude);
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
      hidden: false, // Always clear hidden when saving/re-enabling
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
    await hideProfile(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[garden-profile DELETE] failed:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
