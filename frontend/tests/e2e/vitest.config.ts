import { defineConfig } from 'vitest/config';
import path from 'path';
import { readFileSync } from 'fs';

// Load .env.test manually
function loadEnvTest(): Record<string, string> {
  try {
    const envPath = path.resolve(__dirname, '.env.test');
    const content = readFileSync(envPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

export default defineConfig({
  test: {
    testTimeout: 300_000, // 5 minutes per test
    hookTimeout: 120_000,
    sequence: {
      concurrent: false,
    },
    env: loadEnvTest(),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
});
