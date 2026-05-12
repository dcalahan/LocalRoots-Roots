/**
 * Simple Upstash Redis client using REST API.
 * Replaces @vercel/kv which has version compatibility issues.
 */

// Vercel KV storage integration injects stale KV_REST_API_URL at runtime
// that overrides our project env vars AND blocks custom env vars from loading.
// Hardcode the correct Upstash instance until the integration is disconnected.
// TODO: After disconnecting Vercel KV integration, revert to env vars
const KV_URL = 'https://game-macaque-74038.upstash.io'
// Token also overridden by stale Vercel KV integration — hardcode until disconnected
const KV_TOKEN = process.env.LOCALROOTS_KV_TOKEN || 'gQAAAAAAASE2AAIncDJjNDdiZjBmYTdlZjQ0ZGVkYTIwYzRhYjI5YzY4ZDAyY3AyNzQwMzg'

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

  async del(key: string): Promise<void> {
    await kvCommand('DEL', key)
  },

  async keys(pattern: string): Promise<string[]> {
    const result = await kvCommand('KEYS', pattern)
    return (result as string[]) || []
  },

  /**
   * SET if Not eXists — atomic "claim this key" primitive. Returns true if
   * the key was set (caller "won" the claim), false if the key already
   * existed (someone else set it first). Race-safe by construction.
   *
   * Used as the dedup primitive for off-chain Roots Points credit events:
   * the eventId is computed from the verb + dedup payload, and the first
   * caller to claim the eventId wins; concurrent retries are no-ops.
   */
  async setnx(key: string, value: unknown): Promise<boolean> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const result = await kvCommand('SET', key, serialized, 'NX')
    // Upstash returns "OK" when SET succeeded, null when NX rejected it
    return result === 'OK'
  },
}
