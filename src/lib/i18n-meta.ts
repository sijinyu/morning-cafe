import type { Metadata } from 'next';

// 페이지별 generateMetadata에서 alternates(canonical + hreflang)를 로케일 인식으로 생성.
// Next.js는 metadata를 얕게 병합하므로, child가 alternates를 정의하면 parent(layout)의
// hreflang이 통째로 사라진다. 그래서 각 페이지가 직접 canonical+languages를 다 넣어야 한다.
// path는 선행 슬래시 포함, 로케일 프리픽스 없는 경로 (예: '/cafes', '/cafe/abc').
export function localeAlternates(path: string, locale: string): Metadata['alternates'] {
  const koPath = path === '/' ? '' : path;
  const canonicalPath =
    locale === 'ko' ? koPath || '/' : `/${locale}${koPath}`;
  return {
    canonical: canonicalPath,
    languages: {
      ko: koPath || '/',
      en: `/en${koPath}`,
      ja: `/ja${koPath}`,
    },
  };
}
