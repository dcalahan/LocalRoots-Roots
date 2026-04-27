// Sentry disabled Apr 28 2026 — see next.config.js header for re-enable
// instructions. Next.js still calls register() on cold start; this is now
// a no-op.
// import * as Sentry from '@sentry/nextjs'

export async function register() {
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   await import('../sentry.server.config')
  // }
  //
  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('../sentry.edge.config')
  // }
}

// export const onRequestError = Sentry.captureRequestError
