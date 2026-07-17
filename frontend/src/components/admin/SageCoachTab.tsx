'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import type {
  CoachDigest,
  StoredBrainProposal,
  StoredMemWrite,
} from '@/lib/coach/types';

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-roots-primary/10 text-roots-primary',
  approved: 'bg-yellow-100 text-yellow-700',
  applied: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
};

interface CoachData {
  latestDigest: CoachDigest | null;
  digestDates: string[];
  proposals: StoredBrainProposal[];
  reproCount: number;
  recentMemWrites: StoredMemWrite[];
}

export function SageCoachTab() {
  const { address } = useAdminStatus();
  const [data, setData] = useState<CoachData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sage-coach?adminAddress=${address}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async () => {
    if (!address) return;
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await fetch(`/api/cron/sage-coach?force=true&adminAddress=${address}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Run failed');
      setRunMsg(
        `Reviewed ${json.reviewed} · ${json.findings} findings · ${json.memWrites} auto-memories · ${json.reproBanked} repro cases`,
      );
      await load();
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const setProposalStatus = async (id: string, status: string) => {
    if (!address) return;
    try {
      const res = await fetch('/api/admin/sage-coach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress: address, id, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (isLoading) return <div className="text-roots-gray p-4">Loading Sage Coach…</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  const proposals = data?.proposals ?? [];
  const openProposals = proposals.filter((p) => p.status === 'proposed');

  return (
    <div className="space-y-6">
      {/* Header + run-now */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Sage Coach</h2>
          <p className="text-sm text-roots-gray">
            Nightly self-improvement — findings, brain PRs, auto-applied memories, repro bank (L2 + L2.5).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runMsg && <span className="text-xs text-roots-gray">{runMsg}</span>}
          <Button onClick={runNow} disabled={running}>
            {running ? 'Running…' : 'Run coach now'}
          </Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Open proposals" value={openProposals.length} />
        <Stat label="Repro cases banked" value={data?.reproCount ?? 0} />
        <Stat
          label="Auto-memories (7d)"
          value={data?.recentMemWrites.length ?? 0}
        />
        <Stat label="Digests" value={data?.digestDates.length ?? 0} />
      </div>

      {/* Latest digest */}
      {data?.latestDigest ? (
        <div className="border border-roots-gray/20 rounded-lg overflow-hidden">
          <div className="bg-roots-cream px-4 py-2 text-sm font-semibold">
            Latest digest — {data.latestDigest.date}
          </div>
          <div
            className="p-4 bg-white overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: data.latestDigest.html }}
          />
        </div>
      ) : (
        <div className="text-roots-gray text-sm p-4 border border-dashed border-roots-gray/30 rounded-lg">
          No digest yet. Click “Run coach now” to review the last 24h of Sage conversations.
        </div>
      )}

      {/* Brain PR queue */}
      {openProposals.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">🧠 Brain PRs awaiting review</h3>
          <p className="text-xs text-roots-gray mb-3">
            Never auto-applied. To apply an approved rule, edit garden-brain.ts + sageRules.ts and bump SAGE_BRAIN_VERSION, then mark “applied”.
          </p>
          <div className="space-y-3">
            {openProposals.map((p) => (
              <div key={p.id} className="border border-roots-secondary/30 rounded-lg p-3 bg-roots-secondary/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-roots-gray">
                    {p.finding_type}
                    {p.placement_hint ? ` · ${p.placement_hint}` : ''}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PROPOSAL_STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{p.proposed_rule}</div>
                {p.rationale && <div className="mt-1 text-xs text-roots-gray">Why: {p.rationale}</div>}
                {p.repro_excerpt && (
                  <pre className="mt-2 p-2 bg-white border border-gray-100 rounded text-xs whitespace-pre-wrap overflow-x-auto">
                    {p.repro_excerpt}
                  </pre>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setProposalStatus(p.id, 'approved')}
                    className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setProposalStatus(p.id, 'applied')}
                    className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 hover:bg-green-200"
                  >
                    Mark applied
                  </button>
                  <button
                    onClick={() => setProposalStatus(p.id, 'rejected')}
                    className="text-xs px-3 py-1 rounded-full text-roots-gray hover:bg-gray-100"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent auto-memories */}
      {data && data.recentMemWrites.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">🔁 Auto-applied per-user memories (last 7 days)</h3>
          <p className="text-xs text-roots-gray mb-3">
            Reversible, scoped to one user each. This is the channel that fixes an individual&apos;s Sage without a human step.
          </p>
          <ul className="space-y-1 text-sm">
            {data.recentMemWrites.map((m, i) => (
              <li key={i} className="border-l-2 border-roots-secondary/40 pl-3 py-1">
                <span className="font-medium text-roots-gray">{m.userLabel}</span>: {m.fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-roots-gray/15 rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-roots-primary">{value}</div>
      <div className="text-xs text-roots-gray">{label}</div>
    </div>
  );
}
