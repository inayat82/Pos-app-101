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
};

export default nextConfig;
