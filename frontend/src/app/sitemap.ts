import type { MetadataRoute } from 'next';
import { getAllCollectionsAsync } from '@/lib/collections';

const BASE = 'https://www.localroots.love';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/grow`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/sell`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/buy`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/about/tokenomics`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/government`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const collections = await getAllCollectionsAsync();
  const gardenPages: MetadataRoute.Sitemap = collections.map(c => ({
    url: `${BASE}/garden/${c.slug}`,
    lastModified: c.addedDate,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...gardenPages];
}
