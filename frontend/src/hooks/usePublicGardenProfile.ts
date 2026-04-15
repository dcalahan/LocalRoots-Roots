'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PublicGardenProfile } from '@/types/garden-profile';

interface OptInInput {
  displayName: string;
  bio?: string;
  latitude?: number;
  longitude?: number;
  profilePhotoUrl?: string;
  profilePhotoIpfs?: string;
  gardenPhotoUrl?: string;
  gardenPhotoIpfs?: string;
}

export function usePublicGardenProfile(userId: string | null) {
  const [profile, setProfile] = useState<PublicGardenProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/gardener-profile?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setProfile(data.profile || null);
    } catch {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const optIn = useCallback(async (input: OptInInput) => {
    if (!userId) return;
    setError(null);
    try {
      const res = await fetch('/api/gardener-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  }, [userId]);

  const optOut = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const res = await fetch(`/api/gardener-profile?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      throw err;
    }
  }, [userId]);

  return { profile, isPublic: !!profile, isLoading, error, optIn, optOut, refresh };
}
