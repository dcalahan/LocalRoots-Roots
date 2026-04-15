import { NextResponse } from 'next/server';

export async function GET() {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  return NextResponse.json({
    upstashUrl: (process.env.UPSTASH_REDIS_REST_URL || '').substring(0, 35),
    kvUrl: (process.env.KV_REST_API_URL || '').substring(0, 35),
    usingUrl: (kvUrl || '').substring(0, 35),
    hasToken: !!kvToken,
    test: 'will ping',
  });
}
