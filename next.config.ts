import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This disables ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This disables TypeScript strict checking during builds
    ignoreBuildErrors: true,
  },
  // Turbopack configuration (stable)
  turbopack: {
    rules: {
      // Configure any specific Turbopack rules if needed
    },
  },
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
