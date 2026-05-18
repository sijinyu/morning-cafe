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
  skipWaiting: true,
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
    // Naver photos via proxy — stale-while-revalidate (1 day, 100 entries)
    {
      matcher: /\/api\/photo-proxy\?.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "cafe-photos-proxy",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60,
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

// 새 SW 활성화 시 옛날 w400 URL이 담긴 캐시 삭제
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.delete("place-detail-api").then(() =>
      caches.delete("cafe-photos-proxy")
    )
  );
});

serwist.addEventListeners();
