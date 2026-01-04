'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import {
  OPERATIONS_TREASURY_ADDRESS,
  OPERATIONS_TREASURY_ABI,
} from '@/lib/contracts/operationsTreasury';
import type { ServiceConfig, PaymentRecord } from '@/types/operations';

interface UseOperationsTreasuryReturn {
  // State
  balance: bigint | null;
  services: ServiceConfig[];
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => void;
  getServiceConfig: (serviceId: `0x${string}`) => ServiceConfig | undefined;
  getPaymentHistory: (serviceId: `0x${string}`) => Promise<PaymentRecord[]>;
}

export function useOperationsTreasury(): UseOperationsTreasuryReturn {
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = OPERATIONS_TREASURY_ADDRESS;

  // Read treasury balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: contractAddress,
    abi: OPERATIONS_TREASURY_ABI,
    functionName: 'getBalance',
    query: {
      enabled: !!contractAddress,
    },
  });

  // Read service IDs
  const { data: serviceIds, refetch: refetchServiceIds } = useReadContract({
    address: contractAddress,
    abi: OPERATIONS_TREASURY_ABI,
    functionName: 'getServiceIds',
    query: {
      enabled: !!contractAddress,
    },
  });

  // Fetch all service configs when serviceIds change
  useEffect(() => {
    async function fetchServices() {
      if (!serviceIds || !contractAddress) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const configs: ServiceConfig[] = [];

        for (const serviceId of serviceIds) {
          // We would use wagmi's useReadContract here, but for simplicity
          // we'll just store the serviceIds and fetch on demand
          configs.push({
            serviceId: serviceId as `0x${string}`,
            name: '',
            payee: '0x0' as `0x${string}`,
            monthlyBudget: 0n,
            currentSpend: 0n,
            lastResetTime: 0,
            active: false,
            requiresOfframp: false,
          });
        }

        setServices(configs);
      } catch (err) {
        console.error('[useOperationsTreasury] Error fetching services:', err);
        setError(err instanceof Error ? err.message : 'Failed to load services');
      } finally {
        setIsLoading(false);
      }
    }

    fetchServices();
  }, [serviceIds, contractAddress]);

  // Refresh all data
  const refresh = useCallback(() => {
    refetchBalance();
    refetchServiceIds();
  }, [refetchBalance, refetchServiceIds]);

  // Get a specific service config
  const getServiceConfig = useCallback(
    (serviceId: `0x${string}`) => {
      return services.find((s) => s.serviceId === serviceId);
    },
    [services]
  );

  // Get payment history for a service (placeholder - needs contract call)
  const getPaymentHistory = useCallback(
    async (serviceId: `0x${string}`): Promise<PaymentRecord[]> => {
      if (!contractAddress) return [];

      // This would need to make multiple contract calls to get all payments
      // For now, return empty array
      console.log('[useOperationsTreasury] getPaymentHistory not fully implemented', serviceId);
      return [];
    },
    [contractAddress]
  );

  return {
    balance: balance ?? null,
    services,
    isLoading,
    error: contractAddress ? error : 'Operations Treasury not configured',
    refresh,
    getServiceConfig,
    getPaymentHistory,
  };
}
