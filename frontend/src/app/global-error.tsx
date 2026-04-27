'use client'

// Sentry disabled Apr 28 2026 — see next.config.js header for re-enable
// instructions. The global-error boundary still renders, but no longer
// reports the error to Sentry.
// import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
// import { useEffect } from 'react'

export default function GlobalError({
  error: _error,
}: {
  error: Error & { digest?: string }
}) {
  // useEffect(() => {
  //   Sentry.captureException(_error)
  // }, [_error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
