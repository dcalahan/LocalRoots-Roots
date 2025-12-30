/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
    ],
  },
  // Empty turbopack config to use Turbopack (Next.js 16 default)
  turbopack: {},
};

module.exports = nextConfig;
