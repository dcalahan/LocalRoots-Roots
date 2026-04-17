import type { Metadata } from 'next';
import Link from 'next/link';
import type { PublicGardenProfileView } from '@/types/garden-profile';
import { STATUS_CONFIG } from '@/lib/gardenStatus';
import { getCropEmoji } from '@/lib/cropEmoji';
import { getProfile, buildProfileView } from '@/lib/gardenProfileStore';

async function fetchGardener(userId: string): Promise<PublicGardenProfileView | null> {
  try {
    const profile = await getProfile(userId);
    if (!profile || profile.hidden) return null;
    return await buildProfileView(profile);
  } catch (err) {
    console.error('[gardener-profile] fetchGardener failed:', err);
    return null;
  }
}

// Force dynamic rendering — KV data changes frequently
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const gardener = await fetchGardener(userId);
  if (!gardener) return {};

  const cropNames = gardener.currentlyGrowing.slice(0, 5).map(c => c.cropName);
  const growing = cropNames.length > 0 ? ` Growing ${cropNames.join(', ')}.` : '';
  const description = gardener.bio
    ? `${gardener.bio}${growing}`
    : `${gardener.displayName} in ${gardener.locationLabel}.${growing}`;

  return {
    title: `${gardener.displayName} | Local Roots`,
    description,
    openGraph: {
      title: gardener.displayName,
      description,
      url: `https://www.localroots.love/gardeners/${encodeURIComponent(userId)}`,
      siteName: 'Local Roots',
      images: [
        {
          url: gardener.gardenPhotoUrl || gardener.profilePhotoUrl || 'https://www.localroots.love/og-image.png',
          width: 1200,
          height: 630,
        },
      ],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: gardener.displayName,
      description,
    },
  };
}

export default async function GardenerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const gardener = await fetchGardener(userId);

  if (!gardener) {
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
          ← Neighbors' Gardens
        </Link>

        {/* Garden photo banner */}
        {gardener.gardenPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gardener.gardenPhotoUrl}
            alt={gardener.displayName}
            className="w-full h-48 object-cover rounded-xl mb-4"
          />
        )}

        {/* Hero */}
        <header className="mb-6 flex items-center gap-4">
          {gardener.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gardener.profilePhotoUrl}
              alt={gardener.displayName}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-roots-secondary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🌱</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{gardener.displayName}</h1>
            <p className="text-sm text-roots-gray">{gardener.locationLabel}</p>
            {gardener.bio && (
              <p className="text-sm text-gray-700 mt-1 italic">&ldquo;{gardener.bio}&rdquo;</p>
            )}
          </div>
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
                              <span>{getCropEmoji(c.cropId)}</span>
                              <span className="text-gray-800">{c.cropName}</span>
                              <span className="text-[10px] uppercase tracking-wide text-roots-gray bg-roots-cream rounded-full px-2 py-0.5">
                                {STATUS_CONFIG[c.status].label}
                              </span>
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
                  <span>{getCropEmoji(c.cropId)}</span>
                  <span className="text-gray-800">{c.cropName}</span>
                  <span className="text-[10px] uppercase tracking-wide text-roots-gray bg-roots-cream rounded-full px-2 py-0.5">
                    {STATUS_CONFIG[c.status].label}
                  </span>
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
