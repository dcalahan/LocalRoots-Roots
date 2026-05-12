import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import type { GardenPlant, GardenBed, MyGardenData } from '@/types/my-garden';
import { warmFacebookOgCache } from '@/lib/facebookOgScrape';
import { credit } from '@/lib/offchainRP';

function kvKey(userId: string): string {
  return `my-garden:${userId}`;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ plants: [], beds: [] });
  }

  try {
    const data = await kv.get<MyGardenData>(kvKey(userId));
    return NextResponse.json({
      plants: data?.plants || [],
      beds: data?.beds || [],
    });
  } catch {
    return NextResponse.json({ plants: [], beds: [] });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plants, beds } = body as {
      userId: string;
      plants: GardenPlant[];
      beds?: GardenBed[];
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Detect new plants (plant.id not in previously-stored data) BEFORE
    // writing the new data, so RP credits fire exactly once per genuinely-
    // new plant. credit() is idempotent on its end too (setnx on event key),
    // so duplicate PUTs from the debounced client save can't double-credit.
    const previousData = await kv.get<MyGardenData>(kvKey(userId)).catch(() => null);
    const previousPlantIds = new Set(previousData?.plants?.map(p => p.id) ?? []);
    const newlyAddedPlants = (plants || []).filter(p => p.id && !previousPlantIds.has(p.id));

    const data: MyGardenData = {
      version: 2,
      plants: plants || [],
      beds: beds || [],
    };
    await kv.set(kvKey(userId), data);

    // Warm Facebook OG cache if user has a public garden profile
    kv.get(`garden-profile:${userId}`).then(profile => {
      if (profile) warmFacebookOgCache(`/gardeners/${encodeURIComponent(userId)}`).catch(() => {});
    }).catch(() => {});

    // Credit off-chain Roots Points for each newly-added plant.
    // - Sequential (not Promise.all) so the user summary's read-modify-write
    //   doesn't race against itself.
    // - credit() never throws — KV failure returns ok:false and we surface
    //   the partial result. Plant data is already saved at this point;
    //   missing RP credit on a partial failure is recoverable later, missing
    //   plant data is not.
    // - Per-plant rejection reasons (daily-cap, lifetime-cap, anonymous) are
    //   counted separately so the toast layer can show "+50 RP" instead of
    //   "+75 RP" if the 4th plant of the day hit the cap.
    let creditedCount = 0;
    let rpEarned = 0;
    let newTotal = 0;
    let cappedCount = 0;
    for (const plant of newlyAddedPlants) {
      const result = await credit('plant-added', userId, plant.id);
      if (result.ok && result.credited) {
        creditedCount++;
        rpEarned += result.rpAmount;
        newTotal = result.newTotal;
      } else if (result.ok && !result.credited) {
        if (result.reason === 'daily-cap' || result.reason === 'lifetime-cap') {
          cappedCount++;
        }
        // duplicate / not-live / anonymous are silently ignored — the user
        // doesn't need to know the difference from the UI perspective.
      }
      // result.ok === false → KV write failed mid-credit. Logged inside
      // credit(); we keep iterating in case some succeed.
    }

    return NextResponse.json({
      ok: true,
      rp: {
        credited: creditedCount,
        rpAmount: rpEarned,
        newTotal,
        cappedCount,
      },
    });
  } catch (err) {
    console.error('[my-garden] Save failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
