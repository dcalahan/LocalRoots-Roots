'use client';

import { useState, useCallback } from 'react';
import { usePrivy, useSignTypedData } from '@privy-io/react-auth';
import { type Address, encodeFunctionData } from 'viem';
import { createFreshPublicClient } from '@/lib/viemClient';
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
 * Uses Privy's embedded wallet for signing (for sellers/ambassadors)
 *
 * Usage:
 * const { executeGasless, isLoading, error } = usePrivyGaslessTransaction();
 *
 * const txHash = await executeGasless({
 *   to: MARKETPLACE_ADDRESS,
 *   abi: marketplaceAbi,
 *   functionName: 'acceptOrder',
 *   args: [orderId],
 * });
 */
export function usePrivyGaslessTransaction(): GaslessTransactionResult {
  const { user, authenticated } = usePrivy();
  const { signTypedData } = useSignTypedData();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privyAddress = user?.wallet?.address as Address | undefined;

  const executeGasless = useCallback(
    async (params: GaslessTransactionParams): Promise<`0x${string}` | null> => {
      if (!authenticated || !privyAddress) {
        setError('Wallet not connected');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const publicClient = createFreshPublicClient();

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
          args: [privyAddress],
        }) as bigint;

        // 3. Set deadline to 10 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 600;

        // 4. Build the forward request
        const forwardRequest: ForwardRequest = {
          from: privyAddress,
          to: params.to,
          value: 0n,
          gas: params.gas || 500000n,
          nonce,
          deadline,
          data,
        };

        console.log('[usePrivyGaslessTransaction] Forward request:', {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: forwardRequest.value.toString(),
          gas: forwardRequest.gas.toString(),
          nonce: forwardRequest.nonce.toString(),
          deadline: forwardRequest.deadline,
          dataLength: forwardRequest.data.length,
        });

        // 5. Sign the typed data (EIP-712) using Privy
        const messageToSign = {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: forwardRequest.value,
          gas: forwardRequest.gas,
          nonce: forwardRequest.nonce,
          deadline: forwardRequest.deadline,
          data: forwardRequest.data,
        };

        console.log('[usePrivyGaslessTransaction] Signing EIP-712 typed data via Privy...');

        let signature: string;
        try {
          const result = await signTypedData(
            {
              domain: forwarderDomain,
              types: forwardRequestTypes,
              primaryType: 'ForwardRequest',
              message: messageToSign,
            },
            {
              address: privyAddress,
            }
          );
          signature = result.signature;
          console.log('[usePrivyGaslessTransaction] Signature obtained:', signature.slice(0, 20) + '...');
        } catch (signError) {
          console.error('[usePrivyGaslessTransaction] Signing failed:', signError);
          const signErrorMsg = signError instanceof Error ? signError.message : String(signError);
          if (signErrorMsg.includes('rejected') || signErrorMsg.includes('denied') || signErrorMsg.includes('cancelled')) {
            setError('Signature request was cancelled. Please try again.');
          } else {
            setError(`Failed to sign: ${signErrorMsg}`);
          }
          setIsLoading(false);
          return null;
        }

        // 6. Send to relayer API
        console.log('[usePrivyGaslessTransaction] Sending to relay API...');
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
          console.error('[usePrivyGaslessTransaction] Relay error:', result);
          throw new Error(result.error || 'Relay failed');
        }

        console.log('[usePrivyGaslessTransaction] Transaction hash:', result.transactionHash);
        return result.transactionHash as `0x${string}`;
      } catch (err) {
        console.error('[usePrivyGaslessTransaction] Error:', err);
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [privyAddress, authenticated, signTypedData]
  );

  return {
    executeGasless,
    isLoading,
    error,
  };
}
