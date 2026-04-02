import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// TEMPORARY - remove after debugging
export async function GET() {
  try {
    // Try SCAN-based key listing (works on all Upstash plans)
    let keys: string[] = []
    try {
      keys = await kv.keys('garden:*')
    } catch (keysErr) {
      // KEYS might be disabled; try SCAN
      try {
        let cursor = 0
        do {
          const [nextCursor, batch] = await kv.scan(cursor, { match: 'garden:*', count: 100 })
          cursor = Number(nextCursor)
          keys.push(...(batch as string[]))
        } while (cursor !== 0)
      } catch (scanErr) {
        return NextResponse.json({
          error: 'Both KEYS and SCAN failed',
          keysErr: String(keysErr),
          scanErr: String(scanErr),
        })
      }
    }

    const results: Record<string, unknown> = {}
    for (const key of keys) {
      const val = await kv.get(key)
      if (key.includes('conv')) {
        const msgs = (val as { messages?: { role: string; content: unknown }[] })?.messages || []
        results[key] = {
          messageCount: msgs.length,
          lastMessages: msgs.slice(-8).map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.slice(0, 300) : '(complex)',
          })),
        }
      } else if (key.includes('memories')) {
        const mems = val as { fact: string; category: string }[] | null
        results[key] = mems
      } else {
        results[key] = typeof val === 'string' ? val.slice(0, 500) : val
      }
    }
    return NextResponse.json({ keyCount: keys.length, keys, results })
  } catch (err) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack?.slice(0, 500) }, { status: 500 })
  }
}
