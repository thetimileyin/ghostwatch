import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone on the same Wi-Fi load the dev server's scripts (ignored in production).
  allowedDevOrigins: ["192.168.1.224"],
  cacheComponents: true,
  // Don't announce the framework in every response.
  poweredByHeader: false,
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
