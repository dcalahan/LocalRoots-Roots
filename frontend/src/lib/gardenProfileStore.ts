/**
 * Server-side helpers for the public garden profile directory.
 *
 * Storage layout (KV):
 *   garden-profile:{userId}    → PublicGardenProfile JSON
 *   garden-profile-index       → string[] of userIds (opted-in)
 *
 * The public profile only stores metadata + opt-in. Beds/plants are read fresh
 * from `my-garden:{userId}` on every view, so updates flow through automatically.
 */

import { kv } from '@/lib/kv';
import type { PublicGardenProfile, PublicGardenProfileView } from '@/types/garden-profile';
import type { MyGardenData } from '@/types/my-garden';
import { computeStatus } from '@/lib/gardenStatus';
import { getCropGrowingInfo } from '@/lib/plantingCalendar';

const PROFILE_KEY = (userId: string) => `garden-profile:${userId}`;
const INDEX_KEY = 'garden-profile-index';
const GARDEN_KEY = (userId: string) => `my-garden:${userId}`;

export async function getProfile(userId: string): Promise<PublicGardenProfile | null> {
  return await kv.get<PublicGardenProfile>(PROFILE_KEY(userId));
}

export async function listOptedInUserIds(): Promise<string[]> {
  const ids = await kv.get<string[]>(INDEX_KEY);
  return Array.isArray(ids) ? ids : [];
}

export async function upsertProfile(profile: PublicGardenProfile): Promise<void> {
  await kv.set(PROFILE_KEY(profile.userId), profile);
  const ids = await listOptedInUserIds();
  if (!ids.includes(profile.userId)) {
    ids.push(profile.userId);
    await kv.set(INDEX_KEY, ids);
  }
}

export async function deleteProfile(userId: string): Promise<void> {
  await kv.del(PROFILE_KEY(userId));
  const ids = await listOptedInUserIds();
  const next = ids.filter(id => id !== userId);
  if (next.length !== ids.length) await kv.set(INDEX_KEY, next);
}

/** Read the user's garden blob and distill it into a privacy-safe view. */
export async function buildProfileView(profile: PublicGardenProfile): Promise<PublicGardenProfileView> {
  const garden = await kv.get<MyGardenData>(GARDEN_KEY(profile.userId));
  const plants = garden?.plants || [];
  const beds = garden?.beds || [];
  const bedById = new Map(beds.map(b => [b.id, b]));

  const now = new Date();
  const currentlyGrowing = plants
    .filter(p => !p.removedDate && !p.harvestedDate)
    .map(p => {
      const info = getCropGrowingInfo(p.cropId);
      return {
        cropId: p.cropId,
        cropName: info?.name || p.cropId,
        bedName: p.bedId ? bedById.get(p.bedId)?.name : undefined,
        status: computeStatus(p, now),
      };
    });

  return { ...profile, beds, currentlyGrowing };
}
