import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site root is the featured year's list. A config redirect, not a page,
  // so it needs no database read and can never be a stale cached render.
  async redirects() {
    return [{ source: "/", destination: `/${process.env.FEATURED_YEAR || 2026}`, permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
