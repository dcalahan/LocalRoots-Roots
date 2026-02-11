'use client';

import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  type Address,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  isAddress,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import type { TokenSymbol } from './useWalletBalances';
import {
  ROOTS_TOKEN_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
} from '@/lib/contracts/marketplace';

// ERC20 transfer ABI
const erc20TransferAbi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Token configurations for sending
const TOKEN_CONFIGS: Record<TokenSymbol, { address?: Address; decimals: number }> = {
  ROOTS: { address: ROOTS_TOKEN_ADDRESS, decimals: 18 },
  USDC: { address: USDC_ADDRESS, decimals: 6 },
  USDT: { address: USDT_ADDRESS, decimals: 6 },
  ETH: { address: undefined, decimals: 18 }, // Native token
};

interface SendTokenParams {
  token: TokenSymbol;
  recipient: string;
  amount: string; // Human-readable amount (e.g., "10.5")
}

interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  totalCostWei: bigint;
  totalCostEth: string;
}

interface UseSendTokenResult {
  send: (params: SendTokenParams) => Promise<`0x${string}` | null>;
  estimateGas: (params: SendTokenParams) => Promise<GasEstimate | null>;
  isPending: boolean;
  error: string | null;
  txHash: `0x${string}` | null;
  clearError: () => void;
}

/**
 * Hook for sending tokens (ERC20 or ETH)
 * Works with both Privy embedded wallets and external wagmi wallets
 */
export function useSendToken(): UseSendTokenResult {
  const { authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const publicClient = usePublicClient();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Get wallet - prefer Privy, fall back to first available
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy');
  const wallet = privyWallet || wallets[0];
  const address = wallet?.address as Address | undefined;
  const isConnected = (authenticated || wallets.length > 0) && walletsReady && !!address;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Validate send parameters
   */
  const validateParams = (params: SendTokenParams): string | null => {
    if (!isConnected || !address) {
      return 'Wallet not connected';
    }

    if (!isAddress(params.recipient)) {
      return 'Invalid recipient address';
    }

    if (params.recipient.toLowerCase() === address.toLowerCase()) {
      return 'Cannot send to yourself';
    }

    const amount = parseFloat(params.amount);
    if (isNaN(amount) || amount <= 0) {
      return 'Invalid amount';
    }

    return null;
  };

  /**
   * Estimate gas for a transfer
   */
  const estimateGas = useCallback(
    async (params: SendTokenParams): Promise<GasEstimate | null> => {
      const validationError = validateParams(params);
      if (validationError) {
        setError(validationError);
        return null;
      }

      if (!publicClient || !address) {
        return null;
      }

      try {
        const config = TOKEN_CONFIGS[params.token];
        const amountWei = parseUnits(params.amount, config.decimals);

        let gasLimit: bigint;

        if (params.token === 'ETH') {
          // Native ETH transfer
          gasLimit = await publicClient.estimateGas({
            account: address,
            to: params.recipient as Address,
            value: amountWei,
          });
        } else {
          // ERC20 transfer
          const data = encodeFunctionData({
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [params.recipient as Address, amountWei],
          });

          gasLimit = await publicClient.estimateGas({
            account: address,
            to: config.address!,
            data,
          });
        }

        // Add 20% buffer for safety
        gasLimit = (gasLimit * 120n) / 100n;

        const gasPrice = await publicClient.getGasPrice();
        const totalCostWei = gasLimit * gasPrice;
        const totalCostEth = formatUnits(totalCostWei, 18);

        return {
          gasLimit,
          gasPrice,
          totalCostWei,
          totalCostEth,
        };
      } catch (err) {
        console.error('Gas estimation failed:', err);
        // Return a default estimate
        return {
          gasLimit: 100000n,
          gasPrice: 1000000000n, // 1 gwei
          totalCostWei: 100000000000000n, // 0.0001 ETH
          totalCostEth: '0.0001',
        };
      }
    },
    [address, isConnected, publicClient]
  );

  /**
   * Send tokens
   */
  const send = useCallback(
    async (params: SendTokenParams): Promise<`0x${string}` | null> => {
      const validationError = validateParams(params);
      if (validationError) {
        setError(validationError);
        return null;
      }

      if (!wallet || !address) {
        setError('Wallet not available');
        return null;
      }

      setIsPending(true);
      setError(null);
      setTxHash(null);

      try {
        const config = TOKEN_CONFIGS[params.token];
        const amountWei = parseUnits(params.amount, config.decimals);

        // Get provider from wallet
        const provider = await wallet.getEthereumProvider();

        // Ensure we're on the right chain
        const chainId = await provider.request({ method: 'eth_chainId' });
        if (parseInt(chainId as string, 16) !== baseSepolia.id) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${baseSepolia.id.toString(16)}` }],
            });
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              // Chain not added, try to add it
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${baseSepolia.id.toString(16)}`,
                    chainName: baseSepolia.name,
                    nativeCurrency: baseSepolia.nativeCurrency,
                    rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
                    blockExplorerUrls: [baseSepolia.blockExplorers?.default.url],
                  },
                ],
              });
            } else {
              throw switchError;
            }
          }
        }

        let hash: `0x${string}`;

        if (params.token === 'ETH') {
          // Native ETH transfer
          hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: address,
                to: params.recipient,
                value: `0x${amountWei.toString(16)}`,
              },
            ],
          }) as `0x${string}`;
        } else {
          // ERC20 transfer
          const data = encodeFunctionData({
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [params.recipient as Address, amountWei],
          });

          hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: address,
                to: config.address,
                data,
              },
            ],
          }) as `0x${string}`;
        }

        setTxHash(hash);

        // Wait for confirmation if public client available
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err: any) {
        console.error('Send failed:', err);

        // Parse common errors
        if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
          setError('Transaction was cancelled');
        } else if (err.message?.includes('insufficient funds')) {
          setError('Insufficient funds for gas');
        } else if (err.message?.includes('transfer amount exceeds balance')) {
          setError('Insufficient token balance');
        } else {
          setError(err.message || 'Transaction failed');
        }

        return null;
      } finally {
        setIsPending(false);
      }
    },
    [wallet, address, publicClient]
  );

  return {
    send,
    estimateGas,
    isPending,
    error,
    txHash,
    clearError,
  };
}
