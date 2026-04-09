import { NextRequest, NextResponse } from 'next/server';
import { getProfile, buildProfileView } from '@/lib/gardenProfileStore';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const profile = await getProfile(userId);
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const view = await buildProfileView(profile);
  return NextResponse.json({ gardener: view });
}
