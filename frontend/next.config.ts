import type { NextConfig } from "next";
import withPWA from 'next-pwa';

const baseConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.vietqr.io',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/cashier',
        destination: '/pos/cashier',
        permanent: false,
      },
    ];
  },
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cloudinary-images',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/menu'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'menu-api',
        networkTimeoutSeconds: 3,
        expiration: { maxAgeSeconds: 3600 },
      },
    },
  ],
})(baseConfig);
