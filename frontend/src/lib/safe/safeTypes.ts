// Types for Gnosis Safe operations

export interface SafeConfig {
  safeAddress: string;
  chainId: number;
}

export interface SafeTransaction {
  to: string;
  value: string;
  data: string;
  operation?: number; // 0 = Call, 1 = DelegateCall
  safeTxGas?: string;
  baseGas?: string;
  gasPrice?: string;
  gasToken?: string;
  refundReceiver?: string;
  nonce?: number;
}

export interface PendingTransaction {
  safeTxHash: string;
  to: string;
  value: string;
  data: string;
  confirmationsRequired: number;
  confirmations: TransactionConfirmation[];
  isExecuted: boolean;
  submissionDate: string;
  executionDate?: string;
  proposer: string;
}

export interface TransactionConfirmation {
  owner: string;
  signature: string;
  submissionDate: string;
}

export interface SafeInfo {
  address: string;
  nonce: number;
  threshold: number;
  owners: string[];
  masterCopy: string;
  modules: string[];
  fallbackHandler: string;
  guard: string;
  version: string;
}

// Service payment specific types
export interface ServicePaymentTransaction {
  serviceId: string;
  serviceName: string;
  amount: bigint;
  payee: string;
  usageIpfsHash: string;
  timestamp: number;
}

// Chain configurations for Safe
export const SAFE_CHAIN_CONFIG = {
  // Base Mainnet
  8453: {
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    safeTransactionServiceUrl: 'https://safe-transaction-base.safe.global',
    blockExplorerUrl: 'https://basescan.org',
  },
  // Base Sepolia
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    safeTransactionServiceUrl: 'https://safe-transaction-base-sepolia.safe.global',
    blockExplorerUrl: 'https://sepolia.basescan.org',
  },
} as const;

export type SupportedChainId = keyof typeof SAFE_CHAIN_CONFIG;

// ERC20 transfer function signature for USDC payments
export const ERC20_TRANSFER_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;
