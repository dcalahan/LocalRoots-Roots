'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData, usePublicClient } from 'wagmi';
import { type Address, encodeFunctionData } from 'viem';
import {
  FORWARDER_ADDRESS,
  forwarderAbi,
  forwarderDomain,
  forwardRequestTypes,
  type ForwardRequest,
} from '@/lib/contracts/forwarder';

interface GaslessTransactionParams {
  to: Address;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  gas?: bigint;
}

interface GaslessTransactionResult {
  executeGasless: (params: GaslessTransactionParams) => Promise<`0x${string}` | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for executing gasless transactions via ERC-2771 meta-transactions
 *
 * Usage:
 * const { executeGasless, isLoading, error } = useGaslessTransaction();
 *
 * const txHash = await executeGasless({
 *   to: MARKETPLACE_ADDRESS,
 *   abi: marketplaceAbi,
 *   functionName: 'registerSeller',
 *   args: [geohashBytes, storefrontIpfs, offersDelivery, offersPickup, deliveryRadiusKm],
 * });
 */
export function useGaslessTransaction(): GaslessTransactionResult {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeGasless = useCallback(
    async (params: GaslessTransactionParams): Promise<`0x${string}` | null> => {
      if (!isConnected || !address) {
        setError('Wallet not connected');
        return null;
      }

      if (!publicClient) {
        setError('Public client not available');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1. Encode the function call data
        const data = encodeFunctionData({
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
        });

        // 2. Get the current nonce for this user
        const nonce = await publicClient.readContract({
          address: FORWARDER_ADDRESS,
          abi: forwarderAbi,
          functionName: 'nonces',
          args: [address],
        }) as bigint;

        // 3. Set deadline to 5 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 300;

        // 4. Build the forward request
        const forwardRequest: ForwardRequest = {
          from: address,
          to: params.to,
          value: 0n,
          gas: params.gas || 500000n, // Default gas limit
          nonce,
          deadline,
          data,
        };

        console.log('[useGaslessTransaction] Forward request:', forwardRequest);

        // 5. Sign the typed data (EIP-712)
        const signature = await signTypedDataAsync({
          domain: forwarderDomain,
          types: forwardRequestTypes,
          primaryType: 'ForwardRequest',
          message: {
            from: forwardRequest.from,
            to: forwardRequest.to,
            value: forwardRequest.value,
            gas: forwardRequest.gas,
            nonce: forwardRequest.nonce,
            deadline: forwardRequest.deadline,
            data: forwardRequest.data,
          },
        });

        console.log('[useGaslessTransaction] Signature:', signature);

        // 6. Send to relayer API
        const response = await fetch('/api/relay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            forwardRequest: {
              from: forwardRequest.from,
              to: forwardRequest.to,
              value: forwardRequest.value.toString(),
              gas: forwardRequest.gas.toString(),
              nonce: forwardRequest.nonce.toString(),
              deadline: forwardRequest.deadline,
              data: forwardRequest.data,
            },
            signature,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Relay failed');
        }

        console.log('[useGaslessTransaction] Transaction hash:', result.transactionHash);
        return result.transactionHash as `0x${string}`;
      } catch (err) {
        console.error('[useGaslessTransaction] Error:', err);
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, isConnected, publicClient, signTypedDataAsync]
  );

  return {
    executeGasless,
    isLoading,
    error,
  };
}
