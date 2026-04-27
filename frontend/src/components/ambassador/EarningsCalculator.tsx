'use client';

/**
 * EarningsCalculator — interactive "what could I make?" tool for the
 * ambassador dashboard.
 *
 * Why: Doug's ambassador-prominence push (Apr 27 2026) — "we undersell
 * how much they can make." Today the dashboard shows what an ambassador
 * has earned. It does NOT show what they could earn if they grew their
 * network. That's a motivation gap. This card closes it.
 *
 * Math sources (all in CLAUDE.md / contracts):
 *   - 25% commission on each recruited seller's sales (cash today,
 *     $ROOTS at token launch)
 *   - 80/20 chain split: direct recruiter keeps 80%, upline gets 20%
 *   - Early-adopter multiplier on Roots Points (2x first 90 days, etc.)
 *
 * Per the tokenomics-proposed principle, we DO show concrete cash
 * numbers (the cash commission program is live and real) but stay vague
 * about Roots Points → $ROOTS conversion since that's not finalized.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AMBASSADOR_COMMISSION_PERCENT,
  getMultiplierInfo,
  PHASE1_LABEL,
} from '@/components/seeds/PhaseConfig';

function formatUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function EarningsCalculator() {
  // Inputs — start with a believable mid-range scenario
  const [sellers, setSellers] = useState(10);
  const [avgMonthlySales, setAvgMonthlySales] = useState(100); // USD
  const [ambassadorRecruits, setAmbassadorRecruits] = useState(3);
  const [sellersPerRecruit, setSellersPerRecruit] = useState(5);

  const multiplier = getMultiplierInfo();
  const commissionRate = AMBASSADOR_COMMISSION_PERCENT / 100; // 0.25

  const calc = useMemo(() => {
    // Direct path: you recruit N sellers averaging $X/mo
    const directMonthly = sellers * avgMonthlySales * commissionRate;
    const directYear = directMonthly * 12;

    // Network path: you ALSO recruit ambassadors who each recruit sellers.
    // 80/20 chain: their direct commission is 25% of their sellers' GMV;
    // YOU get 20% of THEIR commission as the upline.
    const downstreamCommission =
      ambassadorRecruits * sellersPerRecruit * avgMonthlySales * commissionRate;
    const networkBonusMonthly = downstreamCommission * 0.2;
    const networkMonthly = directMonthly + networkBonusMonthly;
    const networkYear = networkMonthly * 12;

    return {
      directMonthly,
      directYear,
      networkBonusMonthly,
      networkMonthly,
      networkYear,
    };
  }, [sellers, avgMonthlySales, ambassadorRecruits, sellersPerRecruit, commissionRate]);

  return (
    <Card className="mb-8 border-2 border-roots-secondary/40 bg-gradient-to-br from-roots-secondary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>🧮</span> What could you earn?
        </CardTitle>
        <p className="text-xs text-roots-gray">
          Plug in a scenario. Two paths: recruit gardeners directly, or
          build a network of ambassadors who recruit on your behalf.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Gardeners you recruit directly"
            value={sellers}
            onChange={setSellers}
            min={0}
            max={500}
            suffix="gardeners"
          />
          <NumberInput
            label="Avg monthly sales per gardener"
            value={avgMonthlySales}
            onChange={setAvgMonthlySales}
            min={0}
            max={2000}
            step={25}
            prefix="$"
          />
          <NumberInput
            label="Ambassadors you recruit"
            value={ambassadorRecruits}
            onChange={setAmbassadorRecruits}
            min={0}
            max={50}
            suffix="ambassadors"
          />
          <NumberInput
            label="Avg gardeners each ambassador recruits"
            value={sellersPerRecruit}
            onChange={setSellersPerRecruit}
            min={0}
            max={50}
            suffix="gardeners each"
          />
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Direct path */}
          <div className="rounded-xl border-2 border-roots-primary/30 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-roots-primary/15 text-roots-primary px-2 py-0.5 rounded-full">
                Direct
              </span>
              <h4 className="font-semibold text-sm">Recruit gardeners</h4>
            </div>
            <div className="space-y-1.5 text-sm">
              <Row label="Per month" value={`${formatUsd(calc.directMonthly)} cash`} />
              <Row
                label="Per year"
                value={`${formatUsd(calc.directYear)} cash`}
                emphasized
              />
            </div>
            <p className="text-[11px] text-roots-gray mt-3">
              Cash via Venmo / PayPal / Zelle. You also earn{' '}
              {PHASE1_LABEL}{' '}
              proportionally — final value set at token launch.
            </p>
          </div>

          {/* Network path */}
          <div className="rounded-xl border-2 border-roots-secondary/40 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-roots-secondary/15 text-roots-secondary px-2 py-0.5 rounded-full">
                Network
              </span>
              <h4 className="font-semibold text-sm">Recruit ambassadors too</h4>
            </div>
            <div className="space-y-1.5 text-sm">
              <Row label="Per month" value={`${formatUsd(calc.networkMonthly)} cash`} />
              <Row
                label="Per year"
                value={`${formatUsd(calc.networkYear)} cash`}
                emphasized
              />
              {calc.networkBonusMonthly > 0 && (
                <Row
                  label="Network bonus / mo"
                  value={`+${formatUsd(calc.networkBonusMonthly)}`}
                  subtle
                />
              )}
            </div>
            <p className="text-[11px] text-roots-gray mt-3">
              Direct earnings + 20% of every downstream ambassador&apos;s
              commission (the 80/20 chain split). Compounds as your network
              grows.
            </p>
          </div>
        </div>

        {/* Multiplier callout */}
        {multiplier.isActive && multiplier.multiplier > 1 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <strong>Early adopter window open:</strong> {PHASE1_LABEL}{' '}
            earned during the first {multiplier.period} count at{' '}
            <strong>{multiplier.multiplierDisplay}</strong>. {multiplier.daysRemaining}{' '}
            days remaining.
          </div>
        )}

        {/* Caveat */}
        <p className="text-[11px] text-roots-gray italic">
          Estimates only. Cash commission is the live, real program. {PHASE1_LABEL}{' '}
          and the future $ROOTS allocation are still being finalized — see{' '}
          <a href="/about/tokenomics" className="underline hover:no-underline">
            proposed tokenomics
          </a>{' '}
          for details.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-roots-gray block mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-roots-gray pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                onChange(Math.max(min ?? 0, Math.min(max ?? Infinity, v)));
              }
            }}
            min={min}
            max={max}
            step={step}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium ${
              prefix ? 'pl-7' : ''
            }`}
            style={{ fontSize: 'max(16px, 0.875rem)' }}
          />
        </div>
        {suffix && (
          <span className="text-xs text-roots-gray whitespace-nowrap">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasized,
  subtle,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-roots-gray ${subtle ? 'text-xs' : ''}`}>{label}</span>
      <span
        className={`font-mono ${
          emphasized
            ? 'text-base font-bold text-gray-900'
            : subtle
            ? 'text-xs text-roots-gray'
            : 'font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
