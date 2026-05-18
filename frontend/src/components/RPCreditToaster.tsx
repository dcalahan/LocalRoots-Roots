'use client';

/**
 * RPCreditToaster — global listener for off-chain Roots Points credit
 * events. Renders nothing visually; its job is to fire toast() on any
 * `app:rp-credited` custom event that surfaces in the app.
 *
 * Mounted once at the app root (layout.tsx). The hook-side surfaces
 * (useMyGarden today; sage chat / photos / harvests in Phase 2) dispatch
 * `app:rp-credited` after a successful credit; this component consumes.
 *
 * Doug's call (May 12 2026): visually quiet. No animations on the pill,
 * no celebration confetti. The toast itself is the toast pattern the
 * app already uses for everything — same coral accent, same dismiss UX.
 *
 * Cap-rejected vs credited: when a credit attempt hits the daily cap,
 * we still toast — but with different copy that makes the limit clear
 * without scolding. Users hitting the cap means they're engaged.
 *
 * Cap toast wording (May 17 2026 plan agent design — fixes Doug's
 * "500 daily cap" confusion):
 *   - Title names the SPECIFIC verb ("Max plants added for today")
 *   - Description says other actions still earn today
 *   - Never names the cap number (anti-gaming)
 *   - Aggregated when multiple verbs cap in one save
 *   - Links to /profile#roots-points so users can see what they DID earn
 *   - Suppressed when anything credited in the same save (single
 *     toast per save — credited > 0 early-return below)
 *
 * Anti-pattern this avoids: per-surface toast() calls scattered across
 * AddPlantsModal, the seller dashboard, etc. Single listener at the
 * root keeps copy + UX consistent.
 */

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { VERBS, type VerbId } from '@/lib/offchainRP';

interface CreditEventDetail {
  credited: number;
  rpAmount: number;
  newTotal: number;
  cappedCount: number;
  /** Specific verbs that capped — used for the cap-rejection toast copy. */
  cappedVerbs?: string[];
  userId?: string;
}

/**
 * Convert a VerbId into the lowercase verb-label noun phrase that fits
 * the "Max ___ for today" title. Falls back to a sensible noun if the
 * verb is unknown (defensive — newer servers might emit verbs older
 * clients don't have in their VERBS registry).
 */
function verbToNoun(verbId: string): string {
  const config = VERBS[verbId as VerbId];
  if (!config) return verbId.replace(/-/g, ' ');
  // The VERBS labels are written as past-tense actions like
  // "Plant added to garden" — we want "plants added", "harvests
  // logged", "beds created" etc. for the "Max ___ for today" title.
  // Specific mapping keeps the toast copy natural.
  const map: Partial<Record<VerbId, string>> = {
    'plant-added': 'plants added',
    'plant-update': 'plant updates',
    'plant-photo': 'plant photos',
    'bed-created': 'beds created',
    'bed-photo': 'bed photos',
    'harvest-logged': 'harvests logged',
    'care-alert-acted-on': 'care actions',
    'share-card-sent': 'shares',
    'listing-created': 'listings',
    'sage-daily': 'Sage check-ins',
    'sage-depth-bonus': 'deep Sage conversations',
    'public-profile-published': 'profile publishes',
    'recruited-gardener-activated': 'gardener activations',
  };
  return map[verbId as VerbId] ?? config.label.toLowerCase();
}

/**
 * Format multiple verb labels as a human-readable list with Oxford comma.
 * 1 → "plants added"
 * 2 → "plants added and beds created"
 * 3+ → "plants added, beds created, and harvests logged"
 */
function joinVerbNouns(verbIds: string[]): string {
  const nouns = verbIds.map(verbToNoun);
  if (nouns.length === 0) return '';
  if (nouns.length === 1) return nouns[0];
  if (nouns.length === 2) return `${nouns[0]} and ${nouns[1]}`;
  return `${nouns.slice(0, -1).join(', ')}, and ${nouns[nouns.length - 1]}`;
}

export function RPCreditToaster() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CreditEventDetail>).detail;
      if (!detail) return;

      // ─── Success path ──────────────────────────────────────────
      // When anything credited in the same save, ONLY show the success
      // toast — never the cap rejection toast. One toast per save is
      // calmer UX. Cap info is still recoverable via /profile's
      // "Today's Earnings" panel.
      if (detail.credited > 0 && detail.rpAmount > 0) {
        toast({
          title: `🌱 +${detail.rpAmount.toLocaleString()} RP`,
          description: `${detail.newTotal.toLocaleString()} Roots Points total`,
        });
        return;
      }

      // ─── Pure cap rejection ────────────────────────────────────
      // No credits this save, but the user did add/edit something
      // they expected to earn from. Name the specific verb (or verbs)
      // that capped so they know it wasn't a global cap — Doug's
      // "500 daily cap" misunderstanding came from the previous
      // generic message.
      if (detail.credited === 0 && detail.cappedCount > 0) {
        const cappedVerbs = detail.cappedVerbs ?? [];

        if (cappedVerbs.length === 0) {
          // No verb info (older server bundle, defensive fallback)
          toast({
            title: '🌱 Daily max reached',
            description: 'You\'ve maxed out on one of these actions for today. Other actions still earn today.',
          });
          return;
        }

        if (cappedVerbs.length === 1) {
          toast({
            title: `🌱 Max ${verbToNoun(cappedVerbs[0])} for today`,
            description: 'You\'ll earn from this again tomorrow. Other actions still earn today.',
          });
          return;
        }

        // Multi-verb (rare — two caps in the same save)
        toast({
          title: `🌱 Daily max reached for ${cappedVerbs.length} actions`,
          description: `${joinVerbNouns(cappedVerbs).charAt(0).toUpperCase()}${joinVerbNouns(cappedVerbs).slice(1)} are maxed for today. Other actions still earn.`,
        });
      }
      // detail.credited === 0 && cappedCount === 0 → silent (most common case:
      // a sync that didn't add new plants — e.g. a status edit)
    };
    window.addEventListener('app:rp-credited', handler);
    return () => window.removeEventListener('app:rp-credited', handler);
  }, [toast]);

  return null;
}
