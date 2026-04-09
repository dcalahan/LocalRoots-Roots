'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import type { PublicGardenProfileView } from '@/types/garden-profile';
import { STATUS_CONFIG } from '@/lib/gardenStatus';

export default function GardenerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const [gardener, setGardener] = useState<PublicGardenProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gardeners/${encodeURIComponent(userId)}`)
      .then(async res => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (cancelled || !data) return;
        setGardener(data.gardener);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white rounded w-48 border border-gray-200" />
            <div className="h-32 bg-white rounded-2xl border border-gray-200" />
            <div className="h-32 bg-white rounded-2xl border border-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !gardener) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Gardener not found</h1>
          <p className="text-sm text-roots-gray mb-4">
            This gardener may have stopped sharing their garden publicly.
          </p>
          <Link href="/gardeners" className="text-roots-secondary font-semibold text-sm">
            ← Back to directory
          </Link>
        </div>
      </div>
    );
  }

  // Group currently growing by bed
  const byBed = new Map<string, typeof gardener.currentlyGrowing>();
  const noBed: typeof gardener.currentlyGrowing = [];
  for (const c of gardener.currentlyGrowing) {
    if (c.bedName) {
      const arr = byBed.get(c.bedName) || [];
      arr.push(c);
      byBed.set(c.bedName, arr);
    } else {
      noBed.push(c);
    }
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/gardeners" className="text-sm text-roots-secondary font-semibold mb-4 inline-block">
          ← All gardeners
        </Link>

        {/* Hero */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{gardener.displayName}</h1>
          <p className="text-sm text-roots-gray">{gardener.locationLabel}</p>
          {gardener.bio && (
            <p className="text-sm text-gray-700 mt-2 italic">&ldquo;{gardener.bio}&rdquo;</p>
          )}
        </header>

        {/* Beds */}
        {gardener.beds.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-roots-gray mb-3">
              Beds
            </h2>
            <div className="space-y-4">
              {gardener.beds.map(bed => {
                const bedCrops = byBed.get(bed.name) || [];
                return (
                  <div key={bed.id} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    {bed.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bed.photoUrl} alt={bed.name} className="w-full h-48 object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900">{bed.name}</h3>
                      <p className="text-xs text-roots-gray mb-2">{bed.type}</p>
                      {bedCrops.length > 0 ? (
                        <ul className="text-sm space-y-1">
                          {bedCrops.map((c, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span>{STATUS_CONFIG[c.status].emoji}</span>
                              <span className="text-gray-800">{c.cropName}</span>
                              <span className="text-xs text-roots-gray">— {STATUS_CONFIG[c.status].label}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-roots-gray italic">Nothing planted here right now.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Unassigned crops */}
        {noBed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-roots-gray mb-3">
              Also growing
            </h2>
            <ul className="text-sm space-y-1 bg-white rounded-2xl border border-gray-200 p-4">
              {noBed.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span>{STATUS_CONFIG[c.status].emoji}</span>
                  <span className="text-gray-800">{c.cropName}</span>
                  <span className="text-xs text-roots-gray">— {STATUS_CONFIG[c.status].label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {gardener.beds.length === 0 && gardener.currentlyGrowing.length === 0 && (
          <p className="text-sm text-roots-gray text-center py-8">
            This gardener hasn&apos;t added any beds or plants yet.
          </p>
        )}
      </div>
    </div>
  );
}
