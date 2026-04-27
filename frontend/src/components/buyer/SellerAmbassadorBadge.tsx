'use client';

/**
 * SellerAmbassadorBadge — small credit on listing/order pages showing
 * which ambassador recruited the seller of this item.
 *
 * Why: buyers see a real human grew this food. The ambassador who
 * brought that grower into the network deserves credit AND becomes a
 * recruiting hook ("huh, I should be one of those") — Doug's
 * ambassador-prominence push (Apr 27 2026).
 *
 * Renders nothing if the seller has no recruiter (gracefully invisible).
 */

import Link from 'next/link';
import { useSellerRecruiter } from '@/hooks/useSellerRecruiter';
import { getIpfsUrl } from '@/lib/pinata';

interface Props {
  sellerId: string | number | bigint | null | undefined;
  /** Compact = inline pill; default = small card. */
  variant?: 'compact' | 'card';
}

export function SellerAmbassadorBadge({ sellerId, variant = 'card' }: Props) {
  const idStr =
    sellerId == null
      ? null
      : typeof sellerId === 'bigint'
      ? sellerId.toString()
      : String(sellerId);
  const { ambassador, profile, isLoading } = useSellerRecruiter(idStr);

  if (isLoading || !ambassador) return null;

  const name = profile?.name?.trim() || `Ambassador #${ambassador.wallet.slice(2, 8)}`;
  const photo = profile?.imageUrl ? resolveImg(profile.imageUrl) : null;

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-roots-gray">
        <span>·</span>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            className="w-4 h-4 rounded-full object-cover"
          />
        ) : null}
        <span>
          Recruited by <span className="font-medium text-roots-secondary">{name}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-roots-secondary/30 bg-roots-secondary/5 p-3 mb-4 flex items-center gap-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-roots-secondary/20 flex items-center justify-center text-sm font-bold text-roots-secondary flex-shrink-0 border-2 border-white">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-roots-gray uppercase tracking-wide font-semibold">
          Brought to LocalRoots by
        </p>
        <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
      </div>
      <Link
        href="/ambassador"
        className="text-xs font-medium text-roots-secondary hover:underline whitespace-nowrap"
      >
        Be one too →
      </Link>
    </div>
  );
}

function resolveImg(ref: string): string {
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return getIpfsUrl(ref);
}
