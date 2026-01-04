'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData, usePublicClient, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
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
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

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
        // 0. Ensure we're on Base Sepolia before signing
        if (chainId !== baseSepolia.id) {
          console.log('[useGaslessTransaction] Current chain:', chainId, 'Switching to Base Sepolia...');
          try {
            await switchChainAsync({
              chainId: baseSepolia.id,
              // This tells wagmi to add the chain if it's not already configured
              addEthereumChainParameter: {
                chainName: baseSepolia.name,
                nativeCurrency: baseSepolia.nativeCurrency,
                rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
                blockExplorerUrls: baseSepolia.blockExplorers?.default ? [baseSepolia.blockExplorers.default.url] : undefined,
              },
            });
          } catch (switchError) {
            console.error('[useGaslessTransaction] Chain switch failed:', switchError);
            // Try to give a more helpful error message
            const errorMsg = switchError instanceof Error ? switchError.message : String(switchError);
            if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
              setError('Chain switch was rejected. Please approve switching to Base Sepolia.');
            } else {
              setError('Please manually switch to Base Sepolia network in your wallet settings.');
            }
            setIsLoading(false);
            return null;
          }
        }

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

        // 3. Set deadline to 10 minutes from now (gives user time to review signing dialog)
        const deadline = Math.floor(Date.now() / 1000) + 600;

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

        console.log('[useGaslessTransaction] Forward request:', {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: forwardRequest.value.toString(),
          gas: forwardRequest.gas.toString(),
          nonce: forwardRequest.nonce.toString(),
          deadline: forwardRequest.deadline,
          dataLength: forwardRequest.data.length,
        });

        // 5. Sign the typed data (EIP-712) using wagmi
        // wagmi handles Privy integration through the wagmi adapter automatically
        const messageToSign = {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: forwardRequest.value,
          gas: forwardRequest.gas,
          nonce: forwardRequest.nonce,
          deadline: forwardRequest.deadline,
          data: forwardRequest.data,
        };

        console.log('[useGaslessTransaction] Signing EIP-712 typed data via wagmi...');

        let signature: `0x${string}`;
        try {
          signature = await signTypedDataAsync({
            domain: forwarderDomain,
            types: forwardRequestTypes,
            primaryType: 'ForwardRequest',
            message: messageToSign,
          });
          console.log('[useGaslessTransaction] Signature obtained:', signature.slice(0, 20) + '...');
        } catch (signError) {
          console.error('[useGaslessTransaction] Signing failed:', signError);
          const signErrorMsg = signError instanceof Error ? signError.message : String(signError);
          if (signErrorMsg.includes('rejected') || signErrorMsg.includes('denied') || signErrorMsg.includes('cancelled')) {
            setError('Signature request was cancelled. Please try again and approve the signature.');
          } else {
            setError(`Failed to sign: ${signErrorMsg}`);
          }
          setIsLoading(false);
          return null;
        }

        // 6. Send to relayer API
        console.log('[useGaslessTransaction] Sending to relay API...');
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
          console.error('[useGaslessTransaction] Relay error:', result);
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
    [address, isConnected, publicClient, signTypedDataAsync, chainId, switchChainAsync]
  );

  return {
    executeGasless,
    isLoading,
    error,
  };
}
