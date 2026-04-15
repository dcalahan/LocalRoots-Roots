import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function GET() {
  try {
    await kv.set('test-ping', 'pong');
    const result = await kv.get('test-ping');
    return NextResponse.json({ ok: true, result, kvUrl: (process.env.LOCALROOTS_KV_URL || process.env.KV_REST_API_URL || '').substring(0, 35) });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'unknown',
      localrootsUrl: (process.env.LOCALROOTS_KV_URL || '').substring(0, 35),
      kvUrl: (process.env.KV_REST_API_URL || '').substring(0, 35),
    });
  }
}
