/**
 * Simple Upstash Redis client using REST API.
 * Replaces @vercel/kv which has version compatibility issues.
 */

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

async function kvCommand(...args: (string | number)[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL or KV_REST_API_TOKEN not set')
  }
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    throw new Error(`KV error: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return data.result
}

export const kv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await kvCommand('GET', key)
    if (result === null || result === undefined) return null
    if (typeof result === 'string') {
      try { return JSON.parse(result) as T } catch { return result as T }
    }
    return result as T
  },

  async set(key: string, value: unknown): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await kvCommand('SET', key, serialized)
  },

  async keys(pattern: string): Promise<string[]> {
    const result = await kvCommand('KEYS', pattern)
    return (result as string[]) || []
  },
}
