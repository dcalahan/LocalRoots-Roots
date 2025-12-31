'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LocationSearch } from '@/components/buyer/LocationSearch';
import { ListingsGrid } from '@/components/buyer/ListingsGrid';
import { FundsAvailable } from '@/components/FundsAvailable';
import { useAllListings } from '@/hooks/useListings';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { features } from '@/config/features';
import { useAccount } from 'wagmi';
import { approximateDistance, bytes8ToGeohash } from '@/lib/geohash';
import { fromKm, getShortUnitLabel } from '@/lib/distance';

interface Location {
  latitude: number;
  longitude: number;
  geohash: string;
  displayName: string;
}

export default function BuyPage() {
  const { preferences, setPreferredLocation, setSearchRadiusKm } = useUserPreferences();
  const { listings, isLoading } = useAllListings();
  const { isConnected } = useAccount();

  // Use persisted location from preferences
  const location = preferences.preferredLocation;
  const searchRadiusKm = preferences.searchRadiusKm;
  const distanceUnit = preferences.distanceUnit;

  const handleLocationSelect = (loc: Location) => {
    setPreferredLocation({
      geohash: loc.geohash,
      displayName: loc.displayName,
    });
  };

  const handleClearLocation = () => {
    setPreferredLocation(null);
  };

  // Filter listings by distance from buyer's location
  const nearbyListings = useMemo(() => {
    if (!location) return [];

    return listings.filter((listing) => {
      // Convert seller's bytes8 geohash to string if it starts with 0x
      const sellerGeohash = listing.seller.geohash.startsWith('0x')
        ? bytes8ToGeohash(listing.seller.geohash as `0x${string}`)
        : listing.seller.geohash;

      // Calculate distance from buyer to seller
      const distanceKm = approximateDistance(location.geohash, sellerGeohash);

      // Only show listings within buyer's search radius
      if (distanceKm > searchRadiusKm) {
        return false;
      }

      // For sellers that only offer delivery (no pickup):
      // Only show if buyer is within seller's delivery radius
      if (listing.seller.offersDelivery && !listing.seller.offersPickup) {
        if (distanceKm > listing.seller.deliveryRadiusKm) {
          return false;
        }
      }

      return true;
    });
  }, [location, listings, searchRadiusKm]);

  // Radius options in km (will be displayed in user's preferred unit)
  const radiusOptions = [5, 10, 25, 50, 100];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {!location ? (
        // Location entry screen
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🥬</div>
            <h1 className="text-3xl font-heading font-bold mb-2">
              Find Fresh, Local Produce
            </h1>
            <p className="text-roots-gray">
              Discover homegrown fruits, vegetables, and more from your neighbors
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Where are you?</CardTitle>
              <CardDescription>
                Enter your location to find sellers near you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationSearch onLocationSelect={handleLocationSelect} />
            </CardContent>
          </Card>

          {features.browseAllListings && (
            <div className="mt-6 text-center">
              <Link href="/buy/listings">
                <Button variant="ghost" className="text-roots-gray">
                  Or browse all listings →
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        // Results screen
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Location header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-heading font-bold">
                  Fresh produce near you
                </h1>
                <p className="text-roots-gray flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {location.displayName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Radius selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-roots-gray">Within:</span>
                  <select
                    value={searchRadiusKm}
                    onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                    className="text-sm border rounded-lg px-2 py-1.5 bg-white"
                  >
                    {radiusOptions.map((km) => (
                      <option key={km} value={km}>
                        {Math.round(fromKm(km, distanceUnit))} {getShortUnitLabel(distanceUnit)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearLocation}>
                  Change Location
                </Button>
              </div>
            </div>

            {/* Listings grid */}
            <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Available Now</h2>
              {features.browseAllListings && (
                <Link href="/buy/listings">
                  <Button variant="ghost" size="sm">
                    View all →
                  </Button>
                </Link>
              )}
            </div>
            <ListingsGrid
              listings={nearbyListings}
              isLoading={isLoading}
              emptyMessage={
                listings.length === 0
                  ? "No sellers have listed produce yet. Be the first to sell in your area!"
                  : `No listings found within ${Math.round(fromKm(searchRadiusKm, distanceUnit))} ${getShortUnitLabel(distanceUnit)}. Try expanding your search radius.`
              }
            />
            </section>
          </div>

          {/* Sidebar - Funds Available (when connected) */}
          {isConnected && (
            <div className="lg:w-72 shrink-0">
              <div className="lg:sticky lg:top-4">
                <FundsAvailable />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
