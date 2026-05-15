import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '모닝커피 — 서울 얼리버드 카페 찾기',
    short_name: '모닝커피',
    description: '서울에서 아침 6~8시에 오픈하는 카페를 지도에서 한눈에 찾아보세요.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#d97706',
    icons: [
      {
        src: '/icons/icon-96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
