/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
} & SerwistGlobalConfig;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Daum CDN cafe photos — URL-immutable, cache-first (7 days, 100 entries)
    {
      matcher: /^https:\/\/t1\.daumcdn\.net\/.*/i,
      handler: new CacheFirst({
        cacheName: "cafe-photos-daum",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Kakao CDN carousel (C280x280) — carousel + lightbox LQIP, cache-first (14 days, 500 entries)
    {
      matcher: /^https:\/\/img1\.kakaocdn\.net\/cthumb\/local\/C280x280\./i,
      handler: new CacheFirst({
        cacheName: "cafe-photos-carousel",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 14 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Kakao CDN HD (R800x0) — lightbox, cache-first (7 days, 200 entries)
    {
      matcher: /^https:\/\/img1\.kakaocdn\.net\/cthumb\/local\/R800x0/i,
      handler: new CacheFirst({
        cacheName: "cafe-photos-hd",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Kakao CDN fallback (legacy C280x280 etc) — cache-first (7 days, 100 entries)
    {
      matcher: /^https:\/\/img1\.kakaocdn\.net\/cthumb\/.*/i,
      handler: new CacheFirst({
        cacheName: "cafe-photos-kakaocdn",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Place-detail API — stale-while-revalidate (3 days, 150 entries)
    {
      matcher: /\/api\/place-detail\?.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "place-detail-api",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 150,
            maxAgeSeconds: 3 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Default cache rules from @serwist/next
    ...defaultCache,
  ],
});

// 새 SW 활성화 시 옛 캐시 삭제 (3-tier 전환 마이그레이션)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete("place-detail-api"),
      caches.delete("cafe-photos-proxy"),
      caches.delete("cafe-photos-kakaocdn"),
      caches.delete("cafe-photos-tiny"),  // C80x80 제거 (2-tier 전환)
      caches.delete("cafe-photos-thumb"), // C160x160 → C280x280 전환
    ])
  );
});

// 클라이언트에서 SKIP_WAITING 메시지 받으면 즉시 활성화
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
