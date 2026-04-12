'use client';

import Link from 'next/link';
import type { PublicGardenProfileView } from '@/types/garden-profile';

interface Props {
  gardener: PublicGardenProfileView;
}

export function GardenerCard({ gardener }: Props) {
  const bedThumbs = gardener.beds.filter(b => b.photoUrl).slice(0, 3);
  const cropCount = gardener.currentlyGrowing.length;

  return (
    <Link
      href={`/gardeners/${encodeURIComponent(gardener.userId)}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-roots-secondary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{gardener.displayName}</h3>
          <p className="text-xs text-roots-gray truncate">{gardener.locationLabel}</p>
        </div>
        <span className="text-xl ml-2">🌱</span>
      </div>

      {bedThumbs.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {bedThumbs.map(b => (
            <div key={b.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-roots-gray">
          {gardener.beds.length} bed{gardener.beds.length !== 1 ? 's' : ''} ·{' '}
          {cropCount} crop{cropCount !== 1 ? 's' : ''}
        </span>
        <span className="text-roots-secondary font-semibold">View →</span>
      </div>
    </Link>
  );
}
