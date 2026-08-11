import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    // genome.kirimedia.co serves the v3 dashboard at its root.
    return [
      { source: "/", has: [{ type: "host", value: "genome.kirimedia.co" }], destination: "/dashboard/v3" },
    ];
  },
};

export default nextConfig;
