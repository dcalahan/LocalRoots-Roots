import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import type { GardenPlant, GardenBed, MyGardenData } from '@/types/my-garden';
import { warmFacebookOgCache } from '@/lib/facebookOgScrape';

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[my-garden] Save failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
