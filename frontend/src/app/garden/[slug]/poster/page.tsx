'use client';

import { useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { getCollection, collectionBuyerUrl } from '@/lib/collections';

/**
 * Community garden poster — thin wrapper around the generic `/poster`
 * primitive. Resolves the garden by slug, builds the right params, and
 * redirects. New poster types should follow this same pattern: look up
 * your data, then forward to `/poster` with the right query string.
 */
export default function CommunityGardenPosterPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const collection = params?.slug ? getCollection(params.slug) : null;
  const garden = collection?.type === 'community-garden' ? collection : null;

  useEffect(() => {
    if (!garden) return;
    const url = collectionBuyerUrl(garden);
    const qs = new URLSearchParams({
      url,
      title: garden.name,
      eyebrow: 'COMMUNITY GARDEN',
      tagline: 'Fresh food grown\na few feet from here.',
      accent: 'teal',
    });
    router.replace(`/poster?${qs.toString()}`);
  }, [garden, router]);

  if (!garden) notFound();
  return null;
}
