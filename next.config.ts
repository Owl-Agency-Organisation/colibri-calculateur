import type { NextConfig } from 'next';

// Page de test /labo/pont et origine du preview acceptée par l'app : jamais en
// production (VERCEL_ENV lu au build ; en local, seulement avec `next dev`).
const LABO_ACTIF =
  process.env.VERCEL_ENV === 'preview' ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'development');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_COLIBRI_LABO: LABO_ACTIF ? '1' : '',
  },
  // Source du script hébergé, lue par app/embed/colibri.js/route.ts
  outputFileTracingIncludes: {
    '/embed/colibri.js': ['./embed/colibri.js'],
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'hooks', 'embed'],
  },
  // Optimisation pour production
  reactStrictMode: true,
  // Compression Gzip
  compress: true,
};

export default nextConfig;
