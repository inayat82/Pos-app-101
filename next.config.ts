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
  // Fix mixed content warnings by ensuring HTTPS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'upgrade-insecure-requests',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
