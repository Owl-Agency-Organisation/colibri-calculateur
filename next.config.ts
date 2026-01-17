import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
    ],
  },
  // Optimisation pour production
  reactStrictMode: true,
  // Compression Gzip
  compress: true,
};

export default nextConfig;