// Types for Operations Treasury and service payments

// Service configuration from the smart contract
export interface ServiceConfig {
  serviceId: `0x${string}`;
  name: string;
  payee: `0x${string}`;
  monthlyBudget: bigint;
  currentSpend: bigint;
  lastResetTime: number;
  active: boolean;
  requiresOfframp: boolean;
}

// Payment record from the smart contract
export interface PaymentRecord {
  timestamp: number;
  amount: bigint;
  usageIpfsHash: string;
  proposedBy: `0x${string}`;
  executed: boolean;
}

// Usage report stored on IPFS
export interface ServiceUsageReport {
  serviceId: string;
  serviceName: string;
  periodStart: number; // Unix timestamp
  periodEnd: number;   // Unix timestamp
  metrics: UsageMetrics;
  totalCostUsd: number;
  breakdown: UsageLineItem[];
  generatedAt: number;
  generatedBy: string; // Admin wallet address
}

// Service-specific usage metrics
export interface UsageMetrics {
  // Anthropic
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  apiCalls?: number;

  // Pinata
  storageGb?: number;
  bandwidthGb?: number;
  filesUploaded?: number;

  // Crossmint
  transactionCount?: number;
  totalFees?: number;

  // thirdweb
  thirdwebApiCalls?: number;
  gasSponsoredTx?: number;

  // Privy
  monthlyActiveUsers?: number;
  authEvents?: number;

  // Generic
  [key: string]: number | undefined;
}

// Line item in usage breakdown
export interface UsageLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

// Predefined service IDs (keccak256 hashes)
export const SERVICE_IDS = {
  anthropic: '0x' + Buffer.from('anthropic').toString('hex').padStart(64, '0') as `0x${string}`,
  pinata: '0x' + Buffer.from('pinata').toString('hex').padStart(64, '0') as `0x${string}`,
  crossmint: '0x' + Buffer.from('crossmint').toString('hex').padStart(64, '0') as `0x${string}`,
  thirdweb: '0x' + Buffer.from('thirdweb').toString('hex').padStart(64, '0') as `0x${string}`,
  privy: '0x' + Buffer.from('privy').toString('hex').padStart(64, '0') as `0x${string}`,
} as const;

// Service display information
export const SERVICE_INFO: Record<string, { name: string; icon: string; description: string }> = {
  anthropic: {
    name: 'Anthropic',
    icon: '🤖',
    description: 'AI assistant for gardening questions (Claude API)',
  },
  pinata: {
    name: 'Pinata',
    icon: '📌',
    description: 'IPFS storage for images and metadata',
  },
  crossmint: {
    name: 'Crossmint',
    icon: '💳',
    description: 'Credit card payment processing',
  },
  thirdweb: {
    name: 'thirdweb',
    icon: '🌐',
    description: 'Payment widget and gas sponsorship',
  },
  privy: {
    name: 'Privy',
    icon: '🔐',
    description: 'Authentication and embedded wallets',
  },
};

// Format USDC amount (6 decimals) to display string
export function formatUSDC(amount: bigint): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

// Parse USD string to USDC amount (6 decimals)
export function parseUSDC(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

// Calculate budget utilization percentage
export function getBudgetUtilization(config: ServiceConfig): number {
  if (config.monthlyBudget === 0n) return 0;
  return Number((config.currentSpend * 100n) / config.monthlyBudget);
}

// Check if budget month has reset
export function isMonthReset(lastResetTime: number): boolean {
  const MONTH_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds
  return Date.now() / 1000 >= lastResetTime + MONTH_DURATION;
}
