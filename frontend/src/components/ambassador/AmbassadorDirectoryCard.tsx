'use client';

/**
 * AmbassadorDirectoryCard — individual card in /ambassadors directory.
 *
 * Renders an ambassador's photo (or fallback), display name, tier
 * badge, recruited gardener count, and a tap target. Pre-launch the
 * cards are read-only — eventually they could deep-link to the
 * ambassador's referral landing page.
 */

import { getAmbassadorTier, CHIEF_AMBASSADOR_TIER } from '@/components/seeds/PhaseConfig';
import { getIpfsUrl } from '@/lib/pinata';
import type { AmbassadorWithProfile } from '@/hooks/useAllAmbassadors';

interface Props {
  entry: AmbassadorWithProfile;
}

export function AmbassadorDirectoryCard({ entry }: Props) {
  const { ambassador, profile } = entry;
  const recruited = Number(ambassador.recruitedSellers || 0n);
  const isChief = !!profile?.isChief;
  const tier = isChief ? CHIEF_AMBASSADOR_TIER : getAmbassadorTier(recruited);

  const displayName = profile?.name?.trim() ||
    `Ambassador #${ambassador.wallet.slice(2, 8)}`;
  const bio = profile?.bio?.trim() || null;
  const photo = profile?.imageUrl ? resolveImg(profile.imageUrl) : null;
  const bookingUrl = profile?.bookingUrl?.trim() || null;

  // Chiefs get a stronger card outline (the coral primary border) so
  // they pop in the directory grid. Lead ambassadors are pre-launch
  // critical infrastructure — we want them visually featured.
  const cardClasses = isChief
    ? 'rounded-2xl border-2 border-roots-primary bg-gradient-to-br from-roots-primary/5 to-white p-4 hover:border-roots-primary transition-colors flex flex-col'
    : 'rounded-2xl border-2 border-gray-200 bg-white p-4 hover:border-roots-secondary/50 transition-colors flex flex-col';

  return (
    <div className={cardClasses}>
      <div className="flex items-start gap-3 mb-3">
        {/* Photo / fallback */}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={displayName}
            className={`w-14 h-14 rounded-full object-cover border-2 flex-shrink-0 ${
              isChief ? 'border-roots-primary' : 'border-roots-secondary/20'
            }`}
          />
        ) : (
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 flex-shrink-0 ${
              isChief
                ? 'bg-roots-primary/15 text-roots-primary border-roots-primary'
                : 'bg-roots-secondary/15 text-roots-secondary border-roots-secondary/20'
            }`}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-gray-900 truncate">
            {displayName}
          </h3>
          <div
            className={`inline-flex items-center gap-1 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color} ${tier.borderColor} border`}
          >
            <span>{tier.emoji}</span>
            <span>{tier.name}</span>
          </div>
        </div>
      </div>

      {bio && (
        <p className="text-sm text-roots-gray italic line-clamp-2 mb-3">
          &ldquo;{bio}&rdquo;
        </p>
      )}

      <div className="mt-auto pt-3 border-t border-gray-100 flex items-baseline justify-between text-sm gap-3">
        <span className="text-roots-gray text-xs">Gardeners recruited</span>
        <span className="font-bold text-gray-900 text-lg">{recruited}</span>
      </div>

      {bookingUrl && (
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-roots-primary text-white hover:bg-roots-primary/90 transition-colors"
        >
          📅 Book a call with {displayName.split(' ')[0]}
        </a>
      )}
    </div>
  );
}

function resolveImg(ref: string): string {
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return getIpfsUrl(ref);
}
