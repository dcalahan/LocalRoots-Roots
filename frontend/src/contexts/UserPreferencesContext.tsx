'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { type DistanceUnit, getPreferredDistanceUnit } from '@/lib/distance';

export type UserRole = 'buyer' | 'seller' | 'ambassador' | null;

interface UserPreferences {
  primaryRole: UserRole;
  preferredLocation: {
    geohash: string;
    displayName: string;
  } | null;
  lastVisitedPage: string | null;
  distanceUnit: DistanceUnit;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  setPrimaryRole: (role: UserRole) => void;
  setPreferredLocation: (location: { geohash: string; displayName: string } | null) => void;
  setLastVisitedPage: (page: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  getRedirectPath: () => string;
  clearPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  primaryRole: null,
  preferredLocation: null,
  lastVisitedPage: null,
  distanceUnit: 'km', // Will be updated based on locale after hydration
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

function getStorageKey(address: string | undefined): string {
  return address ? `localroots-prefs-${address.toLowerCase()}` : 'localroots-prefs-guest';
}

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage when wallet connects
  useEffect(() => {
    setIsLoading(true);
    const storageKey = getStorageKey(address);

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure distanceUnit has a valid value
        if (!parsed.distanceUnit || (parsed.distanceUnit !== 'km' && parsed.distanceUnit !== 'miles')) {
          parsed.distanceUnit = getPreferredDistanceUnit();
        }
        setPreferences(parsed);
      } else {
        // No stored preferences - use defaults with detected distance unit
        setPreferences({
          ...defaultPreferences,
          distanceUnit: getPreferredDistanceUnit(),
        });
      }
    } catch {
      setPreferences({
        ...defaultPreferences,
        distanceUnit: getPreferredDistanceUnit(),
      });
    }

    setIsLoading(false);
  }, [address, isConnected]);

  // Save preferences to localStorage when they change
  const savePreferences = useCallback((newPrefs: UserPreferences) => {
    const storageKey = getStorageKey(address);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPrefs));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }, [address]);

  const setPrimaryRole = useCallback((role: UserRole) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, primaryRole: role };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, [savePreferences]);

  const setPreferredLocation = useCallback((location: { geohash: string; displayName: string } | null) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, preferredLocation: location };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, [savePreferences]);

  const setLastVisitedPage = useCallback((page: string) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, lastVisitedPage: page };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, [savePreferences]);

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, distanceUnit: unit };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, [savePreferences]);

  const getRedirectPath = useCallback((): string => {
    switch (preferences.primaryRole) {
      case 'seller':
        return '/sell/dashboard';
      case 'ambassador':
        return '/ambassador';
      case 'buyer':
      default:
        return '/buy';
    }
  }, [preferences.primaryRole]);

  const clearPreferences = useCallback(() => {
    const storageKey = getStorageKey(address);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear preferences:', e);
    }
    setPreferences(defaultPreferences);
  }, [address]);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        setPrimaryRole,
        setPreferredLocation,
        setLastVisitedPage,
        setDistanceUnit,
        getRedirectPath,
        clearPreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}
