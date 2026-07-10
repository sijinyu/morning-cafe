import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 't1.daumcdn.net' },
      { protocol: 'https', hostname: 'postfiles.pstatic.net' },
      { protocol: 'https', hostname: 'blogfiles.pstatic.net' },
      { protocol: 'https', hostname: 'blogpfthumb-phinf.pstatic.net' },
      { protocol: 'https', hostname: 'img1.kakaocdn.net' },
    ],
  },
};

export default withSerwist(withNextIntl(nextConfig));
