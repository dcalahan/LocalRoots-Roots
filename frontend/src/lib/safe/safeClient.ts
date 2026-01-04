import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { encodeFunctionData, type Address } from 'viem';
import {
  SAFE_CHAIN_CONFIG,
  ERC20_TRANSFER_ABI,
  type SupportedChainId,
  type PendingTransaction,
  type SafeInfo,
} from './safeTypes';

// Environment variables
export const OPERATIONS_SAFE_ADDRESS = process.env.NEXT_PUBLIC_OPERATIONS_SAFE_ADDRESS as Address | undefined;
export const CHAIN_ID = (parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532') as SupportedChainId); // Default to Base Sepolia

// Get chain config
export function getChainConfig(chainId: SupportedChainId = CHAIN_ID) {
  const config = SAFE_CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return config;
}

// Initialize Safe API Kit (for reading pending transactions, etc.)
export function createSafeApiKit(chainId: SupportedChainId = CHAIN_ID): SafeApiKit {
  return new SafeApiKit({
    chainId: BigInt(chainId),
  });
}

// Initialize Safe Protocol Kit (requires a signer)
export async function createSafeProtocolKit(
  safeAddress: string,
  signerPrivateKey?: string
): Promise<Safe> {
  const chainConfig = getChainConfig();

  const safeSDK = await Safe.init({
    provider: chainConfig.rpcUrl,
    signer: signerPrivateKey,
    safeAddress,
  });

  return safeSDK;
}

// Get Safe info (owners, threshold, etc.)
export async function getSafeInfo(safeAddress: string): Promise<SafeInfo | null> {
  try {
    const apiKit = createSafeApiKit();
    const info = await apiKit.getSafeInfo(safeAddress);
    return {
      address: info.address,
      nonce: typeof info.nonce === 'string' ? parseInt(info.nonce, 10) : info.nonce,
      threshold: info.threshold,
      owners: info.owners,
      masterCopy: (info as Record<string, unknown>).masterCopy as string || '',
      modules: info.modules || [],
      fallbackHandler: info.fallbackHandler || '',
      guard: info.guard || '',
      version: info.version || '',
    };
  } catch (error) {
    console.error('[Safe] Error getting Safe info:', error);
    return null;
  }
}

// Get pending transactions for a Safe
export async function getPendingTransactions(safeAddress: string): Promise<PendingTransaction[]> {
  try {
    const apiKit = createSafeApiKit();
    const response = await apiKit.getPendingTransactions(safeAddress);

    return response.results.map((tx) => ({
      safeTxHash: tx.safeTxHash,
      to: tx.to,
      value: tx.value,
      data: tx.data || '0x',
      confirmationsRequired: tx.confirmationsRequired,
      confirmations: tx.confirmations?.map((c) => ({
        owner: c.owner,
        signature: c.signature,
        submissionDate: c.submissionDate,
      })) || [],
      isExecuted: tx.isExecuted,
      submissionDate: tx.submissionDate,
      executionDate: tx.executionDate || undefined,
      proposer: tx.proposer || '',
    }));
  } catch (error) {
    console.error('[Safe] Error getting pending transactions:', error);
    return [];
  }
}

// Encode USDC transfer data
export function encodeUSDCTransfer(to: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [to, amount],
  });
}

// Check if address is a signer of the Safe
export async function isSafeSigner(safeAddress: string, address: string): Promise<boolean> {
  const info = await getSafeInfo(safeAddress);
  if (!info) return false;
  return info.owners.some((owner) => owner.toLowerCase() === address.toLowerCase());
}

// Get transaction confirmations needed
export async function getConfirmationsNeeded(safeAddress: string, safeTxHash: string): Promise<number> {
  try {
    const apiKit = createSafeApiKit();
    const info = await apiKit.getSafeInfo(safeAddress);
    const tx = await apiKit.getTransaction(safeTxHash);

    const currentConfirmations = tx.confirmations?.length || 0;
    return Math.max(0, info.threshold - currentConfirmations);
  } catch (error) {
    console.error('[Safe] Error getting confirmations needed:', error);
    return -1;
  }
}

// Format Safe transaction URL for the Safe web app
export function getSafeTransactionUrl(safeAddress: string, safeTxHash: string): string {
  const chainConfig = getChainConfig();
  const chainPrefix = CHAIN_ID === 8453 ? 'base' : 'basesep';
  return `https://app.safe.global/transactions/tx?safe=${chainPrefix}:${safeAddress}&id=multisig_${safeAddress}_${safeTxHash}`;
}

// Format Safe app URL
export function getSafeAppUrl(safeAddress: string): string {
  const chainPrefix = CHAIN_ID === 8453 ? 'base' : 'basesep';
  return `https://app.safe.global/home?safe=${chainPrefix}:${safeAddress}`;
}
