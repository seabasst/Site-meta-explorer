import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    // genome.kirimedia.co serves the v3 dashboard at its root.
    // Must be beforeFiles: a bare array is afterFiles, which loses to the
    // filesystem route for "/" (src/app/page.tsx) and never fires.
    return {
      beforeFiles: [
        { source: "/", has: [{ type: "host", value: "genome.kirimedia.co" }], destination: "/dashboard/v3" },
      ],
    };
  },
};

export default nextConfig;
