'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { encodeLocation, decodeGeohash } from '@/lib/geohash';

interface LocationPickerProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    geohash: string;
  }) => void;
  initialGeohash?: string;
}

type LocationState = 'idle' | 'loading' | 'success' | 'error';

export function LocationPicker({ onLocationSelect, initialGeohash }: LocationPickerProps) {
  const [state, setState] = useState<LocationState>(initialGeohash ? 'success' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    geohash: string;
  } | null>(() => {
    if (initialGeohash) {
      const decoded = decodeGeohash(initialGeohash);
      return {
        latitude: decoded.latitude,
        longitude: decoded.longitude,
        geohash: initialGeohash,
      };
    }
    return null;
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const geohash = encodeLocation(latitude, longitude);

        const locationData = { latitude, longitude, geohash };
        setLocation(locationData);
        setState('success');
        onLocationSelect(locationData);
      },
      (err) => {
        let errorMessage = 'Unable to get your location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setError(errorMessage);
        setState('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [onLocationSelect]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={getLocation}
          disabled={state === 'loading'}
          variant={state === 'success' ? 'outline' : 'default'}
          className={state === 'success' ? 'border-roots-secondary text-roots-secondary' : ''}
        >
          {state === 'loading' && (
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {state === 'loading' && 'Getting location...'}
          {state === 'idle' && 'Get My Location'}
          {state === 'success' && 'Update Location'}
          {state === 'error' && 'Try Again'}
        </Button>

        {state === 'success' && location && (
          <span className="text-sm text-roots-secondary font-medium">
            Location set
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {location && (
        <div className="text-sm text-roots-gray">
          <p>
            Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </p>
          <p className="text-xs text-gray-400">
            Geohash: {location.geohash}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Your location is used to help buyers find local sellers. Only an approximate
        location (neighborhood level) is stored on the blockchain.
      </p>
    </div>
  );
}
