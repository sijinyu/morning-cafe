import type { MetadataRoute } from 'next';
import { fetchAllGus, fetchAllCafeIds } from '@/lib/supabase/queries';

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

// ko는 프리픽스 없음(as-needed), en/ja는 프리픽스. path는 '/' 또는 '/cafes' 처럼 선행 슬래시 포함.
// 각 URL에 hreflang alternates를 붙여 구글이 다국어 버전을 인지하도록 함.
function entry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap[number] {
  const koPath = path === '/' ? '' : path;
  return {
    url: `${BASE_URL}${koPath || '/'}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: {
        ko: `${BASE_URL}${koPath || '/'}`,
        en: `${BASE_URL}/en${koPath}`,
        ja: `${BASE_URL}/ja${koPath}`,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let gus: string[] = [];
  let cafeIds: string[] = [];

  try {
    [gus, cafeIds] = await Promise.all([fetchAllGus(), fetchAllCafeIds()]);
  } catch {
    // Fallback to empty if Supabase is unavailable during build
  }

  const guEntries = gus.map((gu) => entry(`/cafes/${encodeURIComponent(gu)}`, 'daily', 0.8));
  const cafeEntries = cafeIds.map((id) => entry(`/cafe/${id}`, 'weekly', 0.7));

  return [
    entry('/', 'daily', 1),
    entry('/cafes', 'daily', 0.9),
    ...guEntries,
    ...cafeEntries,
    entry('/favorites', 'weekly', 0.5),
    entry('/report', 'monthly', 0.3),
  ];
}
