import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Unit-test vitest config. Separate from tests/e2e/vitest.config.ts because:
 *   - E2E tests hit live Base Sepolia contracts (5-minute timeout)
 *   - Unit tests run in milliseconds with mocked dependencies
 *
 * Discovery: any *.test.ts file under tests/unit/.
 */
export default defineConfig({
  test: {
    testTimeout: 5_000,
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
})
