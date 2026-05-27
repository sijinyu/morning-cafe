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
    // Kakao CDN cthumb photos — cache-first (7 days, 200 entries)
    {
      matcher: /^https:\/\/img1\.kakaocdn\.net\/cthumb\/.*/i,
      handler: new CacheFirst({
        cacheName: "cafe-photos-kakaocdn",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Place-detail API — stale-while-revalidate (1 day, 50 entries)
    {
      matcher: /\/api\/place-detail\?.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "place-detail-api",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Default cache rules from @serwist/next
    ...defaultCache,
  ],
});

// 새 SW 활성화 시 옛 photo-proxy/place-detail 캐시 삭제 (kakaocdn으로 전환)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete("place-detail-api"),
      caches.delete("cafe-photos-proxy"),
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
