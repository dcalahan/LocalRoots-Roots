import { notFound, redirect } from 'next/navigation';
import { getCollectionAsync, collectionBuyerUrl } from '@/lib/collections';

export const dynamic = 'force-dynamic';

/**
 * Community garden poster — thin wrapper around the generic `/poster`
 * primitive. Resolves the garden by slug (including KV-added ones) and
 * redirects to /poster with the right query string.
 */
export default async function CommunityGardenPosterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionAsync(slug);
  const garden = collection?.type === 'community-garden' ? collection : null;
  if (!garden) notFound();

  const url = collectionBuyerUrl(garden);
  const qs = new URLSearchParams({
    url,
    title: garden.name,
    eyebrow: 'COMMUNITY GARDEN',
    tagline: 'Fresh food grown\na few feet from here.',
    accent: 'teal',
  });
  redirect(`/poster?${qs.toString()}`);
}
