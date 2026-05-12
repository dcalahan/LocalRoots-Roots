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
 * Just adds informative text: "+25 RP" or "Roots Points cap reached
 * — try again tomorrow."
 *
 * Cap-rejected vs credited: when a credit attempt hits the daily cap,
 * we still toast — but with different copy that makes the limit clear
 * without scolding. Users hitting the cap means they're engaged.
 *
 * Anti-pattern this avoids: per-surface toast() calls scattered across
 * AddPlantsModal, the seller dashboard, etc. Single listener at the
 * root keeps copy + UX consistent.
 */

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CreditEventDetail {
  credited: number;
  rpAmount: number;
  newTotal: number;
  cappedCount: number;
  userId?: string;
}

export function RPCreditToaster() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CreditEventDetail>).detail;
      if (!detail) return;

      if (detail.credited > 0 && detail.rpAmount > 0) {
        toast({
          title: `🌱 +${detail.rpAmount.toLocaleString()} RP`,
          description: `${detail.newTotal.toLocaleString()} Roots Points total`,
        });
        return;
      }

      // Pure cap rejection (no credits this PUT, but the user did add plants
      // they expected to earn from). Surface a non-scolding heads-up so
      // they aren't confused about why no RP was earned.
      if (detail.credited === 0 && detail.cappedCount > 0) {
        toast({
          title: 'Daily Roots Points cap reached',
          description: 'You earn up to 100 RP/day from new plants. Try again tomorrow.',
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
