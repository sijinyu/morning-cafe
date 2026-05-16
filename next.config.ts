import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 't1.daumcdn.net' },
      { protocol: 'https', hostname: 'postfiles.pstatic.net' },
    ],
  },
};

export default withSerwist(nextConfig);
