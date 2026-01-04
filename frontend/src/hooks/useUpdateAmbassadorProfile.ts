'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import { usePrivyGaslessTransaction } from '@/hooks/usePrivyGaslessTransaction';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi, type AmbassadorProfile } from '@/lib/contracts/ambassador';

interface UpdateProfileState {
  updateProfile: (profile: AmbassadorProfile) => Promise<boolean>;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
}

/**
 * Hook to update ambassador profile on-chain
 * Uses Privy gasless transactions
 */
export function useUpdateAmbassadorProfile(): UpdateProfileState {
  const { authenticated } = usePrivy();
  const { address } = usePrivyWallet();
  const { uploadJson } = usePinataUpload();

  // Privy gasless transaction support
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = usePrivyGaslessTransaction();

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);

  const isPending = isUploading || isGaslessLoading;
  const error = uploadError || (gaslessError ? new Error(gaslessError) : null);

  const updateProfile = async (profile: AmbassadorProfile): Promise<boolean> => {
    if (!authenticated || !address) {
      setUploadError(new Error('Please sign in first'));
      return false;
    }

    setIsUploading(true);
    setUploadError(null);
    setIsSuccess(false);

    try {
      // Upload profile to IPFS
      const result = await uploadJson(profile as unknown as Record<string, unknown>, `ambassador-${profile.name || 'profile'}.json`);
      if (!result) {
        throw new Error('Failed to upload profile to IPFS');
      }

      const profileIpfs = `ipfs://${result.ipfsHash}`;
      console.log('[useUpdateAmbassadorProfile] Profile uploaded:', profileIpfs);
      setIsUploading(false);

      // Execute gasless transaction via Privy
      console.log('[useUpdateAmbassadorProfile] Executing gasless transaction');
      const txHash = await executeGasless({
        to: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'updateProfile',
        args: [profileIpfs],
        gas: 150000n,
      });

      if (txHash) {
        console.log('[useUpdateAmbassadorProfile] Transaction hash:', txHash);
        setIsSuccess(true);
        return true;
      } else {
        throw new Error(gaslessError || 'Transaction failed');
      }
    } catch (err) {
      console.error('[useUpdateAmbassadorProfile] Error:', err);
      setUploadError(err instanceof Error ? err : new Error('Failed to update profile'));
      setIsUploading(false);
      return false;
    }
  };

  return {
    updateProfile,
    isPending,
    isSuccess,
    error,
  };
}
