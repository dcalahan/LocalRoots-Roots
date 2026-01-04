'use client';

import { useState, useEffect } from 'react';
import { getIpfsUrl } from '@/lib/pinata';
import type { AmbassadorProfile } from '@/lib/contracts/ambassador';

interface AmbassadorProfileState {
  profile: AmbassadorProfile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch ambassador profile from IPFS
 */
export function useAmbassadorProfile(profileIpfs: string | null | undefined): AmbassadorProfileState {
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileIpfs) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = getIpfsUrl(profileIpfs);
        console.log('[useAmbassadorProfile] Fetching from:', url);

        const response = await fetch(url);
        if (!response.ok) {
          // Profile not found or invalid - this is OK, just means no profile uploaded yet
          console.warn('[useAmbassadorProfile] Profile not found:', response.status);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        console.log('[useAmbassadorProfile] Profile data:', data);

        setProfile(data as AmbassadorProfile);
      } catch (err) {
        // Silently handle errors - profile is optional
        console.warn('[useAmbassadorProfile] Could not fetch profile:', err);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [profileIpfs]);

  return { profile, isLoading, error };
}
