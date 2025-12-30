'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { encodeGeohash } from '@/lib/geohash';

interface LocationSearchProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    geohash: string;
    displayName: string;
  }) => void;
  placeholder?: string;
}

export function LocationSearch({ onLocationSelect, placeholder = 'Enter your zip code or address' }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeolocate = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geohash = encodeGeohash(latitude, longitude);

        // Try to reverse geocode for display name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const displayName = data.address?.city || data.address?.town || data.address?.suburb || 'Your Location';

          onLocationSelect({ latitude, longitude, geohash, displayName });
        } catch {
          onLocationSelect({ latitude, longitude, geohash, displayName: 'Your Location' });
        }

        setIsLoading(false);
      },
      (err) => {
        let errorMessage = '';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enter your zip code above instead.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Please enter your zip code above.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please enter your zip code above.';
            break;
          default:
            errorMessage = 'Geolocation not available. Please enter your zip code above.';
        }
        // Check if it's a secure context issue
        if (err.message?.includes('permission') || err.message?.includes('secure')) {
          errorMessage = 'Geolocation requires HTTPS. Please enter your zip code above.';
        }
        setError(errorMessage);
        setIsLoading(false);
        console.error('Geolocation error:', err.message);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [onLocationSelect]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use OpenStreetMap Nominatim for geocoding (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=1`
      );
      const data = await response.json();

      if (data.length === 0) {
        setError('Location not found. Try a different address or zip code.');
        setIsLoading(false);
        return;
      }

      const { lat, lon, display_name } = data[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const geohash = encodeGeohash(latitude, longitude);

      // Simplify display name
      const parts = display_name.split(',');
      const displayName = parts.slice(0, 2).join(',').trim();

      onLocationSelect({ latitude, longitude, geohash, displayName });
    } catch (err) {
      setError('Failed to search location. Please try again.');
      console.error('Geocoding error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, onLocationSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          disabled={isLoading}
        />
        <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-sm text-roots-gray">or</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGeolocate}
        disabled={isLoading}
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Use My Current Location
      </Button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
