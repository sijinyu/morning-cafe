import type { MetadataRoute } from 'next';
import { fetchAllGus } from '@/lib/supabase/queries';

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let gus: string[] = [];
  try {
    gus = await fetchAllGus();
  } catch {
    // Fallback to empty if Supabase is unavailable during build
  }

  const guEntries: MetadataRoute.Sitemap = gus.map((gu) => ({
    url: `${BASE_URL}/cafes/${encodeURIComponent(gu)}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/cafes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...guEntries,
    {
      url: `${BASE_URL}/favorites`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/report`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
