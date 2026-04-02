import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// TEMPORARY - remove after debugging
export async function GET() {
  try {
    const keys = await kv.keys('garden:*')
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
      } else {
        results[key] = val
      }
    }
    return NextResponse.json({ keys, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
