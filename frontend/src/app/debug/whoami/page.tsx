'use client';

/**
 * /debug/whoami — diagnostic page for Sage's "I can't see your garden" bug.
 *
 * Built May 14 2026 because Doug's session was getting empty inventory reads
 * from Sage despite having 24 plants in KV. The bug hypothesis: the userId
 * Sage receives in its POST body (via Privy's user.id) doesn't match the
 * userId where the user's My Garden data is stored in KV.
 *
 * This page runs entirely client-side. It reads the SAME state Sage's chat
 * component reads (privyUser?.id, useWallets(), useAccount()), then probes
 * the KV via /api/my-garden?userId=<candidate> for each plausible userId.
 *
 * The output shows:
 *   - What Privy thinks the user is (id, wallet, email)
 *   - What wagmi thinks (external wallet, if any)
 *   - Whether my-garden KV has data under each of those identifiers
 *   - Which identifier Sage WILL send to /api/garden-ai
 *
 * If KV has data under one identifier and Sage sends a different one, that's
 * the bug — exposed in one glance.
 *
 * Privacy: the page only displays the visitor's own session state. It does
 * not read KV for any userId other than the ones derived from the current
 * session.
 */

import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

interface KvProbe {
  candidateId: string;
  source: string;
  status: 'pending' | 'empty' | 'found' | 'error';
  plantCount?: number;
  bedCount?: number;
  error?: string;
}

export default function WhoamiDebugPage() {
  const { user: privyUser, authenticated, ready: privyReady } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const [probes, setProbes] = useState<KvProbe[]>([]);
  const [reportText, setReportText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Build the set of candidate userIds to probe
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyId = privyUser?.id;
  const privyEmbeddedAddress = embeddedWallet?.address;
  const privyEmail = privyUser?.email?.address;
  const privyEmailType = (privyUser as { email?: { address?: string } } | null)?.email;
  const privyWalletField = privyUser?.wallet?.address;

  // Probe each candidate ID against /api/my-garden
  useEffect(() => {
    if (!privyReady) return;

    const candidates: { id: string; source: string }[] = [];
    if (privyId) candidates.push({ id: privyId, source: 'Privy user.id (what Sage sends)' });
    if (privyEmbeddedAddress) {
      candidates.push({ id: privyEmbeddedAddress, source: 'Privy embedded wallet (mixed case)' });
      candidates.push({ id: privyEmbeddedAddress.toLowerCase(), source: 'Privy embedded wallet (lowercase)' });
    }
    if (privyWalletField && privyWalletField !== privyEmbeddedAddress) {
      candidates.push({ id: privyWalletField, source: 'Privy user.wallet.address' });
    }
    if (wagmiAddress) {
      candidates.push({ id: wagmiAddress, source: 'wagmi external wallet' });
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = candidates.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    const initial: KvProbe[] = unique.map(c => ({
      candidateId: c.id,
      source: c.source,
      status: 'pending',
    }));
    setProbes(initial);

    // Fire one fetch per candidate
    unique.forEach(async (c, idx) => {
      try {
        const res = await fetch(`/api/my-garden?userId=${encodeURIComponent(c.id)}`);
        const data = await res.json();
        const plantCount = (data.plants || []).length;
        const bedCount = (data.beds || []).length;
        setProbes(prev => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            status: plantCount > 0 || bedCount > 0 ? 'found' : 'empty',
            plantCount,
            bedCount,
          };
          return next;
        });
      } catch (err) {
        setProbes(prev => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          };
          return next;
        });
      }
    });
  }, [privyReady, privyId, privyEmbeddedAddress, privyWalletField, wagmiAddress]);

  // Build a copy-paste-ready text report
  useEffect(() => {
    const lines: string[] = [];
    lines.push('=== Sage WHOAMI Diagnostic ===');
    lines.push('');
    lines.push(`Privy ready: ${privyReady}`);
    lines.push(`Authenticated: ${authenticated}`);
    lines.push('');
    lines.push('--- Privy session ---');
    lines.push(`Privy user.id (this is what Sage sends): ${privyId ?? '(null)'}`);
    lines.push(`Privy user.wallet.address: ${privyWalletField ?? '(none)'}`);
    lines.push(`Privy embedded wallet (useWallets): ${privyEmbeddedAddress ?? '(none)'}`);
    lines.push(`Privy email: ${privyEmail ?? '(none)'}`);
    lines.push('');
    lines.push('--- wagmi session ---');
    lines.push(`wagmi connected: ${wagmiConnected}`);
    lines.push(`wagmi address: ${wagmiAddress ?? '(none)'}`);
    lines.push('');
    lines.push('--- KV probes (my-garden) ---');
    probes.forEach(p => {
      const idShort = p.candidateId.length > 40 ? `${p.candidateId.slice(0, 30)}...${p.candidateId.slice(-8)}` : p.candidateId;
      const resultStr = p.status === 'found'
        ? `FOUND — ${p.plantCount} plants, ${p.bedCount} beds`
        : p.status === 'empty'
          ? 'EMPTY'
          : p.status === 'error'
            ? `ERROR: ${p.error}`
            : 'pending...';
      lines.push(`  [${p.source}]`);
      lines.push(`  ID: ${idShort}`);
      lines.push(`  → ${resultStr}`);
      lines.push('');
    });
    setReportText(lines.join('\n'));
  }, [privyReady, authenticated, privyId, privyWalletField, privyEmbeddedAddress, privyEmail, wagmiConnected, wagmiAddress, probes]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select all
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold mb-1">Sage WHOAMI Diagnostic</h1>
        <p className="text-roots-gray text-sm">
          Compares your Privy/wagmi session state to what&apos;s in the My Garden KV.
          Identifies whether Sage&apos;s userId matches your data&apos;s userId.
        </p>
      </header>

      {!privyReady && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Privy still loading…
        </div>
      )}

      {privyReady && !authenticated && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm">
          You&apos;re not signed in. Sign in first via the wallet button in the header, then refresh this page.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
        <h2 className="font-heading font-semibold text-lg">Session state</h2>
        <dl className="text-sm space-y-1.5 font-mono">
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">Privy ready:</dt><dd>{String(privyReady)}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">Authenticated:</dt><dd>{String(authenticated)}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">Privy user.id:</dt><dd className="break-all">{privyId ?? <span className="text-amber-700">(null)</span>}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">Embedded wallet:</dt><dd className="break-all">{privyEmbeddedAddress ?? '(none)'}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">user.wallet.address:</dt><dd className="break-all">{privyWalletField ?? '(none)'}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">Email:</dt><dd>{privyEmail ?? '(none)'}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">wagmi connected:</dt><dd>{String(wagmiConnected)}</dd></div>
          <div className="flex gap-2"><dt className="text-roots-gray w-48 shrink-0">wagmi address:</dt><dd className="break-all">{wagmiAddress ?? '(none)'}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="font-heading font-semibold text-lg">My Garden KV probes</h2>
        <p className="text-sm text-roots-gray">
          For each identifier above, this page calls <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/api/my-garden?userId=&lt;id&gt;</code>.
          A &quot;FOUND&quot; result means the KV has data under that key — that&apos;s where Sage SHOULD look. The
          first row (Privy user.id) is what Sage actually sends today.
        </p>
        <div className="space-y-2.5">
          {probes.length === 0 && privyReady && (
            <div className="text-sm text-roots-gray italic">No candidate identifiers — session may be empty.</div>
          )}
          {probes.map((p) => {
            const colors =
              p.status === 'found' ? 'bg-roots-secondary/10 border-roots-secondary/40' :
                p.status === 'empty' ? 'bg-gray-50 border-gray-200' :
                  p.status === 'error' ? 'bg-red-50 border-red-200' :
                    'bg-amber-50 border-amber-200';
            return (
              <div key={p.candidateId} className={`rounded-md border p-3 ${colors}`}>
                <div className="text-xs text-roots-gray mb-1">{p.source}</div>
                <div className="font-mono text-xs break-all mb-1">{p.candidateId}</div>
                <div className="text-sm">
                  {p.status === 'pending' && <span className="text-amber-700">⏳ probing…</span>}
                  {p.status === 'empty' && <span className="text-roots-gray">○ EMPTY — no plants or beds for this key</span>}
                  {p.status === 'found' && (
                    <span className="text-roots-secondary font-semibold">
                      ✓ FOUND — {p.plantCount} plants, {p.bedCount} beds
                    </span>
                  )}
                  {p.status === 'error' && <span className="text-red-700">✕ ERROR: {p.error}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="font-heading font-semibold text-lg">Copy diagnostic report</h2>
        <p className="text-sm text-roots-gray">
          Paste this into chat so we can see the full picture without back-and-forth.
        </p>
        <pre className="text-xs bg-gray-50 rounded border border-gray-200 p-3 overflow-auto whitespace-pre-wrap font-mono">{reportText}</pre>
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded-md bg-roots-primary text-white text-sm font-medium hover:bg-roots-primary/90"
        >
          {copied ? 'Copied!' : 'Copy report to clipboard'}
        </button>
      </section>
    </div>
  );
}
