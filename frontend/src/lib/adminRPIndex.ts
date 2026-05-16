/**
 * Admin RP index builder.
 *
 * Scans the KV namespace `rp:offchain:*`, aggregates per-user summaries
 * and recent events, writes denormalized indexes that the admin UI reads.
 *
 * Why this exists: the naive "live KV scan on every admin page load"
 * approach falls over at 1000+ users. At 1000 users × ~12 verbs × 30
 * days = ~360K event keys, KEYS rp:offchain:event:* on Upstash is O(N).
 * The cron pre-builds purpose-shaped indexes; admin pages read those
 * indexes with sub-100ms latency.
 *
 * Indexes built per cron run:
 *
 *   rp:admin:index:recent-events   — Sorted list of last 1000 credit
 *                                    events (audit records), newest first
 *   rp:admin:index:top-earners     — Sorted list of users by total RP
 *   rp:admin:index:user:{userId}   — Per-user enriched record
 *   rp:admin:index:meta            — Last-run timing + counts
 *
 * Cron runs every 5 minutes (Phase 1). May drop to 1 min in Phase 2+
 * once Doug uses the surface actively (per his approved plan).
 *
 * Notes:
 * - All reads are KEYS-based scans, not paginated. Acceptable while
 *   `rp:offchain:event:*` is under ~50K entries. When it grows, add
 *   incremental indexing (track last-processed eventId in meta).
 * - The cron never reads admin flag records — that's Phase 2 work.
 *   For Phase 1 every user is treated as unflagged in the indexes.
 */

import { kv } from '@/lib/kv';
import type { CreditEventRecord, UserMeta, UserRPSummary, VerbId } from '@/lib/offchainRP';

// ─── Index shapes (read by /api/admin/rp/* routes) ──────────────────

export interface RecentEventEntry {
  eventId: string;
  verbId: VerbId;
  privyAddress: string; // userId — could be did:privy:... or 0x...
  rpAmount: number;
  dedupKey: string;
  timestamp: string;
}

export interface TopEarnerEntry {
  userId: string;
  total: number;
  byVerb: UserRPSummary['byVerb'];
  lastUpdated: string;
  eventCount: number; // approximate, derived from byVerb counts
  /** First-seen IP geo. Null when user pre-dates the May 16 capture commit. */
  userMeta?: UserMeta | null;
}

export interface UserDetailEntry {
  userId: string;
  total: number;
  byVerb: UserRPSummary['byVerb'];
  lastUpdated: string;
  recentEvents: RecentEventEntry[]; // last 50 events for this user
  /** Per-verb daily-counter snapshot for the last 7 days */
  dailyCounters: Record<string, Record<VerbId, number>>;
  /** First-seen IP geo. Null when user pre-dates the May 16 capture commit. */
  userMeta?: UserMeta | null;
}

export interface IndexMeta {
  lastRunAt: string;
  durationMs: number;
  eventCount: number;
  userCount: number;
}

// ─── KV key shapes ───────────────────────────────────────────────────

const INDEX_KEY = {
  recentEvents: 'rp:admin:index:recent-events',
  topEarners: 'rp:admin:index:top-earners',
  meta: 'rp:admin:index:meta',
  userDetail: (userId: string) => `rp:admin:index:user:${userId.toLowerCase()}`,
};

const SOURCE_KEY_PATTERN = {
  events: 'rp:offchain:event:*',
  users: 'rp:offchain:[^:]*', // user totals, NOT events/daily/lifetime
};

/**
 * Build all admin indexes from a single KV scan. Returns the meta record.
 * Caller is responsible for any external auditing/logging.
 */
export async function buildAdminRPIndexes(): Promise<IndexMeta> {
  const startMs = Date.now();

  // ── Step 1: Read every event audit record ────────────────────────
  // Each `rp:offchain:event:{eventId}` is a single credit event.
  const eventKeys = await kv.keys(SOURCE_KEY_PATTERN.events);
  const events: CreditEventRecord[] = [];
  for (const key of eventKeys) {
    const record = await kv.get<CreditEventRecord>(key);
    if (record && record.timestamp) {
      events.push(record);
    }
  }
  // Sort newest first by timestamp.
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // ── Step 2: Read every user total + first-seen IP geo metadata ───
  // `rp:offchain:{userId}` — note: KEYS pattern can't easily exclude
  // sub-namespaces (event/daily/lifetime/user-meta). We scan the full
  // `rp:offchain:*` namespace and filter to user-summary records.
  const allOffchainKeys = await kv.keys('rp:offchain:*');
  const userSummaries: { userId: string; summary: UserRPSummary; meta: UserMeta | null }[] = [];
  for (const key of allOffchainKeys) {
    // Exclude sub-namespaces: event:, daily:, lifetime:, user-meta:
    if (
      key.startsWith('rp:offchain:event:') ||
      key.startsWith('rp:offchain:daily:') ||
      key.startsWith('rp:offchain:lifetime:') ||
      key.startsWith('rp:offchain:user-meta:')
    ) {
      continue;
    }
    const userId = key.slice('rp:offchain:'.length);
    if (!userId) continue;
    const summary = await kv.get<UserRPSummary>(key);
    if (summary && typeof summary.total === 'number') {
      // Fetch user-meta for first-seen IP geo (may not exist for users
      // who pre-date the May 16 capture commit).
      const meta = await kv.get<UserMeta>(`rp:offchain:user-meta:${userId.toLowerCase()}`);
      userSummaries.push({ userId, summary, meta });
    }
  }

  // ── Step 3: Write Recent Events index ────────────────────────────
  // Keep last 1000. Sort already done above.
  const recentEvents: RecentEventEntry[] = events.slice(0, 1000).map((e) => ({
    eventId: e.eventId,
    verbId: e.verbId,
    privyAddress: e.privyAddress,
    rpAmount: e.rpAmount,
    dedupKey: e.dedupKey,
    timestamp: e.timestamp,
  }));
  await kv.set(INDEX_KEY.recentEvents, recentEvents);

  // ── Step 4: Write Top Earners index ──────────────────────────────
  const topEarners: TopEarnerEntry[] = userSummaries
    .map(({ userId, summary, meta }) => {
      let eventCount = 0;
      for (const verbRow of Object.values(summary.byVerb)) {
        if (verbRow && typeof verbRow.count === 'number') {
          eventCount += verbRow.count;
        }
      }
      return {
        userId,
        total: summary.total,
        byVerb: summary.byVerb,
        lastUpdated: summary.lastUpdated,
        eventCount,
        userMeta: meta,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 500);
  await kv.set(INDEX_KEY.topEarners, topEarners);

  // ── Step 5: Write per-user detail records ────────────────────────
  // Each user gets their recent events (filtered from the global feed)
  // and a 7-day daily-counter snapshot.
  const eventsByUser = new Map<string, CreditEventRecord[]>();
  for (const e of events) {
    const list = eventsByUser.get(e.privyAddress.toLowerCase()) || [];
    list.push(e);
    eventsByUser.set(e.privyAddress.toLowerCase(), list);
  }

  for (const { userId, summary, meta } of userSummaries) {
    const userIdLower = userId.toLowerCase();
    const userEvents = (eventsByUser.get(userIdLower) || []).slice(0, 50).map((e) => ({
      eventId: e.eventId,
      verbId: e.verbId,
      privyAddress: e.privyAddress,
      rpAmount: e.rpAmount,
      dedupKey: e.dedupKey,
      timestamp: e.timestamp,
    }));

    // 7-day daily counters — fetch keys matching the user's day-counter
    // namespace. Pattern: `rp:offchain:daily:{userIdLower}:{verbId}:{YYYY-MM-DD}`
    const dailyKeyPrefix = `rp:offchain:daily:${userIdLower}:`;
    const dailyKeys = await kv.keys(`${dailyKeyPrefix}*`);
    const dailyCounters: Record<string, Record<VerbId, number>> = {};
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const dKey of dailyKeys) {
      // dKey = `rp:offchain:daily:{userIdLower}:{verbId}:{YYYY-MM-DD}`
      const suffix = dKey.slice(dailyKeyPrefix.length);
      const parts = suffix.split(':');
      if (parts.length !== 2) continue;
      const [verbId, date] = parts;
      if (date < sevenDaysAgo) continue;
      const count = (await kv.get<number>(dKey)) ?? 0;
      if (!dailyCounters[date]) dailyCounters[date] = {} as Record<VerbId, number>;
      dailyCounters[date][verbId as VerbId] = count;
    }

    const detail: UserDetailEntry = {
      userId,
      total: summary.total,
      byVerb: summary.byVerb,
      lastUpdated: summary.lastUpdated,
      recentEvents: userEvents,
      dailyCounters,
      userMeta: meta,
    };
    await kv.set(INDEX_KEY.userDetail(userId), detail);
  }

  // ── Step 6: Write meta record ────────────────────────────────────
  const indexMeta: IndexMeta = {
    lastRunAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    eventCount: events.length,
    userCount: userSummaries.length,
  };
  await kv.set(INDEX_KEY.meta, indexMeta);

  return indexMeta;
}

// ─── Reader helpers (used by /api/admin/rp/* routes) ───────────────

export async function readRecentEvents(limit = 100, offset = 0): Promise<RecentEventEntry[]> {
  const all = (await kv.get<RecentEventEntry[]>(INDEX_KEY.recentEvents)) ?? [];
  return all.slice(offset, offset + limit);
}

export async function readTopEarners(limit = 50, offset = 0): Promise<TopEarnerEntry[]> {
  const all = (await kv.get<TopEarnerEntry[]>(INDEX_KEY.topEarners)) ?? [];
  return all.slice(offset, offset + limit);
}

export async function readUserDetail(userId: string): Promise<UserDetailEntry | null> {
  return await kv.get<UserDetailEntry>(INDEX_KEY.userDetail(userId));
}

export async function readIndexMeta(): Promise<IndexMeta | null> {
  return await kv.get<IndexMeta>(INDEX_KEY.meta);
}
