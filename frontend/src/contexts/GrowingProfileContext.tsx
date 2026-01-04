'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import {
  GrowingProfile,
  getGrowingProfileFromGeohash,
  getGrowingProfile,
  applyManualOverrides,
  formatFrostDate,
  getZoneDescription,
} from '@/lib/growingZones';

interface GrowingProfileOverrides {
  zone?: string;
  lastSpringFrost?: string; // ISO date string
  firstFallFrost?: string;
}

interface GrowingProfileContextType {
  profile: GrowingProfile | null;
  isLoading: boolean;
  hasManualOverride: boolean;
  error: string | null;
  // Setters
  setManualZone: (zone: string) => void;
  setManualFrostDates: (lastSpring: Date, firstFall: Date) => void;
  clearOverrides: () => void;
  // Helpers
  formatFrostDate: (date: Date) => string;
  getZoneDescription: (zone: string) => string;
}

const GrowingProfileContext = createContext<GrowingProfileContextType | undefined>(undefined);

const STORAGE_KEY = 'localroots-growing-overrides';

export function GrowingProfileProvider({ children }: { children: ReactNode }) {
  const { profile: sellerProfile, isLoading: isLoadingSeller } = useSellerProfile();
  const [growingProfile, setGrowingProfile] = useState<GrowingProfile | null>(null);
  const [overrides, setOverrides] = useState<GrowingProfileOverrides | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load overrides from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setOverrides(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save overrides to localStorage
  const saveOverrides = useCallback((newOverrides: GrowingProfileOverrides | null) => {
    try {
      if (newOverrides) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOverrides));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
    setOverrides(newOverrides);
  }, []);

  // Calculate growing profile from seller location or browser geolocation
  useEffect(() => {
    async function calculateProfile() {
      setIsLoading(true);
      setError(null);

      try {
        let baseProfile: GrowingProfile | null = null;

        // Priority 1: Use seller's geohash if available
        if (sellerProfile?.geohash) {
          baseProfile = getGrowingProfileFromGeohash(sellerProfile.geohash);
        }

        // Priority 2: Try browser geolocation
        if (!baseProfile && typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 300000, // 5 minutes cache
              });
            });
            baseProfile = getGrowingProfile(
              position.coords.latitude,
              position.coords.longitude
            );
          } catch {
            // Geolocation failed or denied - continue without it
          }
        }

        // Priority 3: Default to Zone 7a (common mid-Atlantic zone)
        if (!baseProfile) {
          baseProfile = getGrowingProfile(39.0, -77.0); // Washington DC area
          baseProfile.confidence = 'estimated';
        }

        // Apply any manual overrides
        if (overrides) {
          const overrideData: Parameters<typeof applyManualOverrides>[1] = {};

          if (overrides.zone) {
            overrideData.zone = overrides.zone;
          }
          if (overrides.lastSpringFrost) {
            overrideData.lastSpringFrost = new Date(overrides.lastSpringFrost);
          }
          if (overrides.firstFallFrost) {
            overrideData.firstFallFrost = new Date(overrides.firstFallFrost);
          }

          if (Object.keys(overrideData).length > 0) {
            baseProfile = applyManualOverrides(baseProfile, overrideData);
          }
        }

        setGrowingProfile(baseProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to calculate growing profile');
      } finally {
        setIsLoading(false);
      }
    }

    // Don't calculate while seller profile is still loading
    if (!isLoadingSeller) {
      calculateProfile();
    }
  }, [sellerProfile?.geohash, isLoadingSeller, overrides]);

  const setManualZone = useCallback((zone: string) => {
    saveOverrides({
      ...overrides,
      zone,
    });
  }, [overrides, saveOverrides]);

  const setManualFrostDates = useCallback((lastSpring: Date, firstFall: Date) => {
    saveOverrides({
      ...overrides,
      lastSpringFrost: lastSpring.toISOString(),
      firstFallFrost: firstFall.toISOString(),
    });
  }, [overrides, saveOverrides]);

  const clearOverrides = useCallback(() => {
    saveOverrides(null);
  }, [saveOverrides]);

  return (
    <GrowingProfileContext.Provider
      value={{
        profile: growingProfile,
        isLoading: isLoading || isLoadingSeller,
        hasManualOverride: overrides !== null,
        error,
        setManualZone,
        setManualFrostDates,
        clearOverrides,
        formatFrostDate,
        getZoneDescription,
      }}
    >
      {children}
    </GrowingProfileContext.Provider>
  );
}

export function useGrowingProfile() {
  const context = useContext(GrowingProfileContext);
  if (context === undefined) {
    throw new Error('useGrowingProfile must be used within a GrowingProfileProvider');
  }
  return context;
}

// Safe version that returns null when used outside provider (for components that may or may not be in provider)
export function useGrowingProfileSafe(): GrowingProfileContextType | null {
  const context = useContext(GrowingProfileContext);
  return context ?? null;
}
