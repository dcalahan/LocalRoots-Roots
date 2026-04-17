'use client';

import { useEffect, useState } from 'react';
import type { PublicGardenProfileView } from '@/types/garden-profile';
import { GardenerCard } from '@/components/grow/GardenerCard';

export default function GardenersDirectoryPage() {
  const [gardeners, setGardeners] = useState<PublicGardenProfileView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(centerGeohash5?: string) {
      const url = centerGeohash5 ? `/api/gardeners?geohash5=${centerGeohash5}` : '/api/gardeners';
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) setGardeners(data.gardeners || []);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Try browser geo so the directory sorts by proximity. If denied, just load all.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { encodeGeohash } = await import('@/lib/geohashLocation');
          const g5 = encodeGeohash(pos.coords.latitude, pos.coords.longitude, 5);
          void load(g5);
        },
        () => void load(),
        { timeout: 5000, maximumAge: 300000 },
      );
    } else {
      void load();
    }

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🌍</span> Neighbors&apos; Gardens
          </h1>
          <p className="text-sm text-roots-gray mt-1">
            Neighbors growing food in your area. Tap a card to see their beds and what they&apos;re growing.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : gardeners.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-3">🌻</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No public gardeners yet</h2>
            <p className="text-sm text-roots-gray max-w-sm mx-auto">
              Be the first! Open your garden in the My Garden page and turn on public sharing.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {gardeners.map(g => (
              <GardenerCard key={g.userId} gardener={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
