import fs from 'fs';
import path from 'path';

const STATE_PATH = path.resolve(__dirname, '../.test-state.json');

export interface TestState {
  runTimestamp: string;
  ambassadorId: string;
  sellerId: string;
  listingId: string;
  pickupOrderId: string;
  deliveryOrderId: string;
  proofUploadedAt: number;
  balancesBefore: Record<string, string>;
  // Activation test fields
  buyer2OrderId?: string;
  buyer2ProofUploadedAt?: number;
}

export function readState(): TestState | null {
  try {
    const content = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(content) as TestState;
  } catch {
    return null;
  }
}

export function writeState(state: TestState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log('[State] Written to', STATE_PATH);
}

export function updateState(partial: Partial<TestState>): TestState {
  const existing = readState() || {
    runTimestamp: new Date().toISOString(),
    ambassadorId: '0',
    sellerId: '0',
    listingId: '0',
    pickupOrderId: '0',
    deliveryOrderId: '0',
    proofUploadedAt: 0,
    balancesBefore: {},
  };
  const updated = { ...existing, ...partial };
  writeState(updated);
  return updated;
}
