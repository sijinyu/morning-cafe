import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '모닝커피 — 서울 아침 카페 지도';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export { default } from './opengraph-image';
