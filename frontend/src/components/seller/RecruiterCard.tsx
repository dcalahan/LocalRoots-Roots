'use client';

/**
 * RecruiterCard — surfaces the ambassador who recruited this seller.
 *
 * Why: pre-existing, the seller-ambassador relationship was invisible after
 * registration. Doug's strategic principle (Apr 27 2026) is that
 * ambassadors are critical infrastructure and should be visible
 * throughout the app, especially to the people they brought in. This card
 * sits on the seller dashboard so the gardener can see and reach their
 * ambassador anytime.
 *
 * Renders nothing if the seller has no recruiter (ambassadorId 0) or
 * while loading. We don't show a skeleton — empty state is graceful and
 * silent. If the ambassador profile is missing IPFS metadata, we still
 * render a minimal card with the wallet + ambassadorId so the connection
 * is preserved.
 */

import { useSellerRecruiter } from '@/hooks/useSellerRecruiter';
import { getIpfsUrl } from '@/lib/pinata';

interface RecruiterCardProps {
  sellerId: string | null | undefined;
}

export function RecruiterCard({ sellerId }: RecruiterCardProps) {
  const { ambassador, profile, isLoading } = useSellerRecruiter(sellerId);

  if (isLoading || !ambassador) {
    return null;
  }

  const displayName = profile?.name || `Ambassador #${ambassador.wallet.slice(2, 8)}`;
  const bio = profile?.bio?.trim() || null;
  const email = profile?.email?.trim() || null;
  const imageUrl = profile?.imageUrl ? resolveImg(profile.imageUrl) : null;

  return (
    <div className="rounded-2xl border-2 border-roots-secondary/30 bg-gradient-to-br from-roots-secondary/5 to-transparent p-5 mb-8">
      <div className="flex items-start gap-4">
        {/* Photo / avatar fallback */}
        <div className="flex-shrink-0">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={displayName}
              className="w-14 h-14 rounded-full object-cover bg-white border-2 border-roots-secondary/40"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-roots-secondary/20 flex items-center justify-center text-xl font-bold text-roots-secondary border-2 border-roots-secondary/40">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-roots-secondary/15 text-roots-secondary px-2 py-0.5 rounded-full">
              Your ambassador
            </span>
          </div>
          <h3 className="font-heading font-bold text-lg text-gray-900 truncate">
            {displayName}
          </h3>
          {bio && (
            <p className="text-sm text-roots-gray italic mt-0.5 line-clamp-2">
              &ldquo;{bio}&rdquo;
            </p>
          )}
          <p className="text-xs text-roots-gray mt-2">
            They&apos;re here to help if you have questions about listing,
            pricing, or selling locally — they&apos;re the reason you&apos;re
            on LocalRoots.
          </p>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {email && (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('Hi from LocalRoots')}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-roots-secondary hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send a message
              </a>
            )}
            <span className="text-xs text-roots-gray font-mono">
              ID #{ambassador.wallet.slice(0, 6)}…{ambassador.wallet.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveImg(ref: string): string {
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return getIpfsUrl(ref);
}
