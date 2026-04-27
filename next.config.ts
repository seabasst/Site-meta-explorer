import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Remote patterns for <Image />. Each entry is a trust boundary — Next
    // proxies these through its optimizer, so widen carefully.
    remotePatterns: [
      {
        // Cloudflare R2 public bucket (ad creatives + brand assets).
        protocol: "https",
        hostname: "pub-25ef069908854da9871d20aea605675a.r2.dev",
      },
      {
        // Facebook CDN — brand profile pics + some ad assets not yet mirrored to R2.
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "**.facebook.com",
      },
    ],
  },
};

export default nextConfig;
