'use client';

/**
 * RootsPointsOnboardingModal — one-time educational modal explaining
 * what Roots Points are and what they become.
 *
 * Shown the first time a signed-in user lands on the app. Dismissal is
 * persisted in localStorage with a stable key per user. Never blocks the
 * user — it's a soft welcome, not a paywall.
 *
 * Doug's design call (May 12 2026): "everyone, everywhere should be aware
 * that they are earning points and what will likely happen with the
 * points." This modal is the single educational moment that introduces
 * the system. After dismissal, the ambient header pill + /profile
 * section continue the awareness without the explainer.
 *
 * Mounted globally in layout.tsx. Self-gates on whether to show — checks
 * privyUser + dismissal localStorage flag. Renders nothing if either
 * (a) not signed in, (b) Privy still loading, or (c) already dismissed.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

const DISMISSAL_KEY_PREFIX = 'rp-onboarding-dismissed:';

function dismissalKey(userId: string): string {
  return `${DISMISSAL_KEY_PREFIX}${userId}`;
}

function isDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissalKey(userId)) === 'true';
  } catch {
    return true; // localStorage unavailable → behave as if dismissed (don't pester)
  }
}

function markDismissed(userId: string): void {
  try {
    localStorage.setItem(dismissalKey(userId), 'true');
  } catch {
    /* localStorage unavailable */
  }
}

export function RootsPointsOnboardingModal() {
  const { ready, authenticated, user } = usePrivy();
  const userId = user?.id;
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !userId) {
      setShouldShow(false);
      return;
    }
    // Delay one tick so we don't compete with Privy's own modal/auth UI
    // on first sign-in. Most users will already be authenticated when
    // they hit this — the delay is cheap insurance.
    const t = setTimeout(() => {
      if (!isDismissed(userId)) {
        setShouldShow(true);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, authenticated, userId]);

  if (!shouldShow || !userId) return null;

  const handleDismiss = () => {
    markDismissed(userId);
    setShouldShow(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-onboarding-title"
      onClick={handleDismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-3xl" aria-hidden="true">🌱</span>
          <h2 id="rp-onboarding-title" className="font-heading text-xl font-bold text-gray-900">
            Welcome to Roots Points
          </h2>
        </div>

        <div className="text-sm text-roots-gray space-y-3">
          <p>
            As you use LocalRoots, you&apos;ll earn <strong>Roots Points</strong> — a
            loyalty rewards program for our community. Think of them like
            airline miles for local food.
          </p>
          <p>
            <strong>You earn for almost everything:</strong> chatting with Sage,
            adding plants to your garden, logging harvests, photographing your
            beds, recruiting neighbors, and (of course) buying or selling
            local food.
          </p>
          <p>
            Roots Points will convert to <strong>$ROOTS tokens</strong> when the
            token launches — your slice of the airdrop is proportional to what
            you earn now. The allocation is proposed; final numbers get locked
            in before launch.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Link
            href="/about/tokenomics"
            onClick={handleDismiss}
            className="flex-1 text-center px-4 py-2.5 rounded-lg bg-roots-secondary text-white text-sm font-medium hover:bg-roots-secondary/90 transition-colors"
          >
            See full tokenomics
          </Link>
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-roots-gray text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Got it
          </button>
        </div>

        <p className="text-xs text-roots-gray/70 text-center pt-1">
          You can view your Roots Points anytime in the header or on your profile.
        </p>
      </div>
    </div>
  );
}
