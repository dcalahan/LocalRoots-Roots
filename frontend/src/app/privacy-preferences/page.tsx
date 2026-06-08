'use client';

/**
 * /privacy-preferences — visitor-facing analytics opt-out.
 *
 * Owns one toggle: site analytics ON / OFF. The tracking script reads the
 * `cmp_optout` cookie on the apex domain (`.localroots.love`) and skips
 * beaconing when it's set to `1`. We never call the tracker directly here —
 * we just set / clear the cookie.
 *
 * On localhost (dev), the apex-domain attribute is omitted so the cookie
 * round-trips for local verification. Production cookies always carry the
 * domain attribute so they apply to both `localroots.love` and any subdomain.
 *
 * Linked from /terms ("Site analytics" section) and the global footer.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

const COOKIE_NAME = 'cmp_optout';
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 365 * 2;

function readOptOutCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .some((c) => c === `${COOKIE_NAME}=1`);
}

function setOptOutCookie(optOut: boolean): void {
  if (typeof document === 'undefined') return;
  const onProd =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('localroots.love');
  const domainAttr = onProd ? '; domain=.localroots.love' : '';
  const secureAttr = onProd ? '; secure' : '';
  const maxAge = optOut ? TWO_YEARS_SECONDS : 0;
  document.cookie =
    `${COOKIE_NAME}=1; path=/${domainAttr}; max-age=${maxAge}; samesite=lax${secureAttr}`;
}

export default function PrivacyPreferencesPage() {
  // We render the toggle off-by-default during SSR (analytics ON) so the
  // server output is deterministic, then sync from the real cookie value
  // on mount. `hydrated` gates the interactive UI so users don't see a
  // momentary "wrong" state.
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnalyticsOn(!readOptOutCookie());
    setHydrated(true);
  }, []);

  function handleToggle() {
    const next = !analyticsOn;
    setOptOutCookie(!next); // opt-out when analytics goes OFF
    setAnalyticsOn(next);
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-roots-gray hover:text-roots-primary underline"
          >
            ← Back to Local Roots
          </Link>
        </div>

        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-3">
          Privacy preferences
        </h1>
        <p className="text-roots-gray mb-8">
          We try to do the privacy thing the right way. Here&apos;s what
          we collect and how to turn it off if you&apos;d rather we
          didn&apos;t.
        </p>

        <div className="bg-white rounded-lg border border-roots-gray/20 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-heading text-xl font-bold mb-1">
                Site analytics
              </div>
              <div className="text-sm text-roots-gray">
                {hydrated
                  ? analyticsOn
                    ? 'On — we’re recording anonymous visit data on this browser.'
                    : 'Off — we’re not recording anything from this browser.'
                  : 'Loading your current preference…'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analyticsOn}
              aria-label="Toggle site analytics"
              onClick={handleToggle}
              disabled={!hydrated}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                analyticsOn ? 'bg-roots-secondary' : 'bg-roots-gray/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  analyticsOn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-6 text-sm text-roots-gray space-y-3">
            <p>
              When this is on, a small first-party script stores two
              cookies on your browser (a visitor ID and a session ID),
              and records anonymous things like which pages you visited
              and how long you spent on each. Your IP address is one-way
              hashed before storage — we never write your raw IP to disk.
            </p>
            <p>
              We don&apos;t sell this data, share it with advertisers,
              or use it to follow you around the web. The full
              explanation lives in our{' '}
              <Link
                href="/terms"
                className="underline text-roots-primary hover:text-roots-primary/80"
              >
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="text-center">
          <a
            href="mailto:doug@localroots.love?subject=Privacy data deletion request"
            className="text-sm text-roots-primary hover:text-roots-primary/80 underline"
          >
            Request deletion of my data
          </a>
        </div>
      </div>
    </div>
  );
}
