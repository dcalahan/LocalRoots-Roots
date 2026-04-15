import { NextResponse } from 'next/server';

export async function GET() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return NextResponse.json({ error: 'missing env', hasUrl: !!kvUrl, hasToken: !!kvToken });
  }

  try {
    const res = await fetch(kvUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, status: res.status, data, kvUrl: kvUrl.substring(0, 30) + '...' });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'unknown',
      cause: err instanceof Error && err.cause ? String(err.cause) : 'no cause',
      kvUrl: kvUrl.substring(0, 30) + '...',
    });
  }
}
