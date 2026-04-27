// Sentry disabled Apr 28 2026 — too noisy on every Vercel build, and the
// PII surface (sendDefaultPii + includeLocalVariables + session replays)
// conflicts with the decentralization posture. Files preserved in case
// we want to flip it back on. To re-enable: uncomment the require below,
// uncomment the withSentryConfig wrapper at the bottom of this file, and
// un-comment the bodies of sentry.server.config.ts, sentry.edge.config.ts,
// src/instrumentation.ts, src/instrumentation-client.ts, and the
// Sentry.captureException call in src/app/global-error.tsx.
// const { withSentryConfig } = require('@sentry/nextjs');

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
  async redirects() {
    return [
      {
        // Seeds → Roots Points rebrand (April 2026). Old URL preserved
        // for backlinks from Common Area emails and external references.
        source: '/seeds/leaderboard',
        destination: '/leaderboard',
        permanent: true, // 308
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;

// Sentry disabled — see header comment for re-enable instructions.
// module.exports = withSentryConfig(nextConfig, {
//   org: process.env.SENTRY_ORG,
//   project: process.env.SENTRY_PROJECT,
//   authToken: process.env.SENTRY_AUTH_TOKEN,
//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   tunnelRoute: '/monitoring',
//   sourcemaps: { deleteSourcemapsAfterUpload: true },
// });
