'use client';

/**
 * RPMonitorTab — admin sub-page for off-chain Roots Points observability.
 *
 * Phase 1 of the Doug-approved admin-rp-monitoring-plan.md. READ-ONLY —
 * no actions yet (those land in Phase 2). The point of Phase 1 is for
 * Doug to develop intuition about what's happening in the off-chain RP
 * system before deciding what to act on.
 *
 * Three sub-views, swapped via internal state:
 *   1. Recent Activity — chronological feed of credit events, all users
 *   2. Top Earners — sortable list of users by total RP
 *   3. User Detail — single-user deep dive
 *
 * Data reads from /api/admin/rp/{recent,top-earners,user/[id]} which all
 * read from pre-built indexes at `rp:admin:index:*`. The indexes are
 * rebuilt every 5 minutes by /api/admin/rp-index cron. "Last updated"
 * is the meta record from that cron run.
 *
 * Refresh: "Refresh now" button triggers /api/admin/rp-index?force=true
 * to rebuild the index, then refetches the current sub-view.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import type {
  RecentEventEntry,
  TopEarnerEntry,
  UserDetailEntry,
  IndexMeta,
} from '@/lib/adminRPIndex';
import { VERBS, type VerbId } from '@/lib/offchainRP';

type SubView = 'recent' | 'top-earners' | 'user-detail';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function truncateUserId(id: string): string {
  if (id.length <= 22) return id;
  if (id.startsWith('did:privy:')) {
    return `did:privy:${id.slice(10, 16)}…${id.slice(-4)}`;
  }
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function rpFmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function RPMonitorTab() {
  const { address } = useAdminStatus();
  const [subView, setSubView] = useState<SubView>('recent');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [meta, setMeta] = useState<IndexMeta | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDrillToUser = (userId: string) => {
    setSelectedUserId(userId);
    setSubView('user-detail');
  };

  const handleForceRefresh = useCallback(async () => {
    if (!address) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(
        `/api/admin/rp-index?force=true&adminAddress=${address}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.meta) setMeta(data.meta);
        // After rebuild, the sub-views' own useEffects refetch when meta
        // changes — but they don't currently watch meta. Easier: bump a
        // local refetch counter that each sub-view depends on.
        setRefetchTick((t) => t + 1);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [address]);

  const [refetchTick, setRefetchTick] = useState(0);

  if (!address) {
    return (
      <div className="text-sm text-roots-gray">
        Connect your admin wallet to view RP activity.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — sub-nav + last-updated indicator + refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div className="flex gap-1">
          {([
            { id: 'recent' as SubView, label: 'Recent Activity' },
            { id: 'top-earners' as SubView, label: 'Top Earners' },
            { id: 'user-detail' as SubView, label: 'User Detail' },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setSubView(v.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                subView === v.id
                  ? 'bg-roots-primary/10 text-roots-primary'
                  : 'text-roots-gray hover:text-gray-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-roots-gray">
          {meta && (
            <span>
              Last index: {relativeTime(meta.lastRunAt)} ({meta.eventCount} events, {meta.userCount} users)
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleForceRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      </div>

      {/* Sub-view content */}
      {subView === 'recent' && (
        <RecentActivitySubView
          adminAddress={address}
          onMetaLoad={setMeta}
          onUserClick={handleDrillToUser}
          refetchTick={refetchTick}
        />
      )}
      {subView === 'top-earners' && (
        <TopEarnersSubView
          adminAddress={address}
          onMetaLoad={setMeta}
          onUserClick={handleDrillToUser}
          refetchTick={refetchTick}
        />
      )}
      {subView === 'user-detail' && (
        <UserDetailSubView
          adminAddress={address}
          selectedUserId={selectedUserId}
          onSelectUserId={setSelectedUserId}
          refetchTick={refetchTick}
        />
      )}
    </div>
  );
}

// ─── Recent Activity sub-view ──────────────────────────────────────

interface RecentActivityProps {
  adminAddress: string;
  onMetaLoad: (meta: IndexMeta | null) => void;
  onUserClick: (userId: string) => void;
  refetchTick: number;
}

function RecentActivitySubView({
  adminAddress,
  onMetaLoad,
  onUserClick,
  refetchTick,
}: RecentActivityProps) {
  const [events, setEvents] = useState<RecentEventEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);
    fetch(`/api/admin/rp/recent?adminAddress=${adminAddress}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.events) setEvents(data.events);
        if (data.meta !== undefined) onMetaLoad(data.meta);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => alive && setIsLoading(false));
    return () => { alive = false; };
  }, [adminAddress, refetchTick, onMetaLoad]);

  if (isLoading) return <div className="text-sm text-roots-gray">Loading recent activity…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (events.length === 0) return <div className="text-sm text-roots-gray">No recent activity. The cron may not have run yet — click &quot;Refresh now&quot;.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-roots-gray uppercase tracking-wide">
          <tr className="border-b">
            <th className="text-left py-2 px-2">When</th>
            <th className="text-left py-2 px-2">User</th>
            <th className="text-left py-2 px-2">Verb</th>
            <th className="text-right py-2 px-2">RP</th>
            <th className="text-left py-2 px-2">Dedup key</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.eventId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-1.5 px-2 text-roots-gray whitespace-nowrap">
                {relativeTime(e.timestamp)}
              </td>
              <td className="py-1.5 px-2">
                <button
                  onClick={() => onUserClick(e.privyAddress)}
                  className="font-mono text-xs text-roots-primary hover:underline"
                  title={e.privyAddress}
                >
                  {truncateUserId(e.privyAddress)}
                </button>
              </td>
              <td className="py-1.5 px-2 text-xs">
                {VERBS[e.verbId]?.label ?? e.verbId}
              </td>
              <td className="py-1.5 px-2 text-right font-medium text-roots-secondary">
                +{rpFmt(e.rpAmount)}
              </td>
              <td className="py-1.5 px-2 font-mono text-xs text-roots-gray truncate max-w-[200px]" title={e.dedupKey}>
                {e.dedupKey}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top Earners sub-view ──────────────────────────────────────────

interface TopEarnersProps {
  adminAddress: string;
  onMetaLoad: (meta: IndexMeta | null) => void;
  onUserClick: (userId: string) => void;
  refetchTick: number;
}

function TopEarnersSubView({
  adminAddress,
  onMetaLoad,
  onUserClick,
  refetchTick,
}: TopEarnersProps) {
  const [earners, setEarners] = useState<TopEarnerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);
    fetch(`/api/admin/rp/top-earners?adminAddress=${adminAddress}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.earners) setEarners(data.earners);
        if (data.meta !== undefined) onMetaLoad(data.meta);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => alive && setIsLoading(false));
    return () => { alive = false; };
  }, [adminAddress, refetchTick, onMetaLoad]);

  if (isLoading) return <div className="text-sm text-roots-gray">Loading top earners…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (earners.length === 0) return <div className="text-sm text-roots-gray">No earners yet. The cron may not have run yet — click &quot;Refresh now&quot;.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-roots-gray uppercase tracking-wide">
          <tr className="border-b">
            <th className="text-left py-2 px-2">#</th>
            <th className="text-left py-2 px-2">User</th>
            <th className="text-right py-2 px-2">Total RP</th>
            <th className="text-right py-2 px-2">Events</th>
            <th className="text-left py-2 px-2">Top verb</th>
            <th className="text-left py-2 px-2">Last earned</th>
          </tr>
        </thead>
        <tbody>
          {earners.map((u, i) => {
            // Identify the verb that generated the most RP for this user
            const verbEntries = Object.entries(u.byVerb)
              .filter(([, row]) => row && row.rp > 0)
              .sort((a, b) => (b[1]?.rp ?? 0) - (a[1]?.rp ?? 0));
            const topVerb = verbEntries[0]?.[0] as VerbId | undefined;
            return (
              <tr key={u.userId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-roots-gray">{i + 1}</td>
                <td className="py-1.5 px-2">
                  <button
                    onClick={() => onUserClick(u.userId)}
                    className="font-mono text-xs text-roots-primary hover:underline"
                    title={u.userId}
                  >
                    {truncateUserId(u.userId)}
                  </button>
                </td>
                <td className="py-1.5 px-2 text-right font-semibold text-roots-secondary">
                  {rpFmt(u.total)}
                </td>
                <td className="py-1.5 px-2 text-right text-xs text-roots-gray">
                  {u.eventCount}
                </td>
                <td className="py-1.5 px-2 text-xs">
                  {topVerb ? (VERBS[topVerb]?.label ?? topVerb) : '—'}
                </td>
                <td className="py-1.5 px-2 text-xs text-roots-gray whitespace-nowrap">
                  {relativeTime(u.lastUpdated)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── User Detail sub-view ──────────────────────────────────────────

interface UserDetailProps {
  adminAddress: string;
  selectedUserId: string | null;
  onSelectUserId: (id: string | null) => void;
  refetchTick: number;
}

function UserDetailSubView({
  adminAddress,
  selectedUserId,
  onSelectUserId,
  refetchTick,
}: UserDetailProps) {
  const [detail, setDetail] = useState<UserDetailEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputUserId, setInputUserId] = useState(selectedUserId || '');

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setIsLoading(true);
    setError(null);
    fetch(
      `/api/admin/rp/user/${encodeURIComponent(selectedUserId)}?adminAddress=${adminAddress}`,
    )
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then((result) => {
        if (!alive) return;
        if (!result.ok) {
          setError(result.body.error || `HTTP ${result.status}`);
          setDetail(null);
        } else {
          setDetail(result.body.detail);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => alive && setIsLoading(false));
    return () => { alive = false; };
  }, [adminAddress, selectedUserId, refetchTick]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUserId.trim()) {
      onSelectUserId(inputUserId.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* userId search box */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={inputUserId}
          onChange={(e) => setInputUserId(e.target.value)}
          placeholder="did:privy:cmxxx... or 0x..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md font-mono"
        />
        <Button type="submit" size="sm">Look up</Button>
        {selectedUserId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { onSelectUserId(null); setInputUserId(''); }}
          >
            Clear
          </Button>
        )}
      </form>

      {!selectedUserId && (
        <div className="text-sm text-roots-gray">
          Enter a userId above, or click a user from Recent Activity / Top Earners to drill in.
        </div>
      )}
      {isLoading && <div className="text-sm text-roots-gray">Loading user detail…</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}

      {detail && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-mono text-xs text-roots-gray break-all mb-2">{detail.userId}</div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-roots-gray">Total RP</div>
                <div className="text-2xl font-bold text-roots-secondary">{rpFmt(detail.total)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-roots-gray">Last earned</div>
                <div className="text-sm">{relativeTime(detail.lastUpdated)}</div>
              </div>
            </div>
          </div>

          {/* By-verb breakdown */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Earnings by verb</h4>
            <table className="w-full text-sm">
              <thead className="text-xs text-roots-gray uppercase tracking-wide">
                <tr className="border-b">
                  <th className="text-left py-1.5 px-2">Verb</th>
                  <th className="text-right py-1.5 px-2">RP</th>
                  <th className="text-right py-1.5 px-2">Count</th>
                  <th className="text-left py-1.5 px-2">Last earned</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(detail.byVerb)
                  .filter(([, row]) => row && row.rp > 0)
                  .sort((a, b) => (b[1]?.rp ?? 0) - (a[1]?.rp ?? 0))
                  .map(([verbId, row]) => (
                    <tr key={verbId} className="border-b border-gray-100">
                      <td className="py-1 px-2">{VERBS[verbId as VerbId]?.label ?? verbId}</td>
                      <td className="py-1 px-2 text-right font-medium">{rpFmt(row!.rp)}</td>
                      <td className="py-1 px-2 text-right text-xs text-roots-gray">×{row!.count}</td>
                      <td className="py-1 px-2 text-xs text-roots-gray">{relativeTime(row!.lastEarnedAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Daily counters (7-day window) */}
          {Object.keys(detail.dailyCounters).length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Last 7 days — daily activity</h4>
              <table className="w-full text-xs">
                <thead className="text-roots-gray uppercase tracking-wide">
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2">Date</th>
                    <th className="text-left py-1.5 px-2">Verbs × counts</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(detail.dailyCounters)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([date, counters]) => (
                      <tr key={date} className="border-b border-gray-100">
                        <td className="py-1 px-2 font-mono">{date}</td>
                        <td className="py-1 px-2">
                          {Object.entries(counters).map(([verbId, count]) => (
                            <span key={verbId} className="inline-block mr-3">
                              <span className="text-roots-gray">{VERBS[verbId as VerbId]?.label ?? verbId}</span>{' '}
                              <span className="font-medium">×{count}</span>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent events */}
          {detail.recentEvents.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Recent events ({detail.recentEvents.length})</h4>
              <table className="w-full text-xs">
                <thead className="text-roots-gray uppercase tracking-wide">
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2">When</th>
                    <th className="text-left py-1.5 px-2">Verb</th>
                    <th className="text-right py-1.5 px-2">RP</th>
                    <th className="text-left py-1.5 px-2">Dedup key</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentEvents.map((e) => (
                    <tr key={e.eventId} className="border-b border-gray-100">
                      <td className="py-1 px-2 text-roots-gray whitespace-nowrap">{relativeTime(e.timestamp)}</td>
                      <td className="py-1 px-2">{VERBS[e.verbId]?.label ?? e.verbId}</td>
                      <td className="py-1 px-2 text-right text-roots-secondary font-medium">+{rpFmt(e.rpAmount)}</td>
                      <td className="py-1 px-2 font-mono text-roots-gray truncate max-w-[240px]" title={e.dedupKey}>
                        {e.dedupKey}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
