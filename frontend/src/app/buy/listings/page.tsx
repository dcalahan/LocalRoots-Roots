'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListingsGrid, CategoryFilter } from '@/components/buyer/ListingsGrid';
import { useAllListings } from '@/hooks/useListings';

export default function BrowseListingsPage() {
  const { listings, isLoading, error } = useAllListings();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    listings.forEach((l) => {
      if (l.metadata.category) {
        cats.add(l.metadata.category);
      }
    });
    return Array.from(cats).sort();
  }, [listings]);

  // Filter by category
  const filteredListings = useMemo(() => {
    if (!selectedCategory) return listings;
    return listings.filter((l) => l.metadata.category === selectedCategory);
  }, [listings, selectedCategory]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-roots-gray mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Browse All Listings</h1>
          <p className="text-roots-gray">
            {listings.length} {listings.length === 1 ? 'item' : 'items'} available
          </p>
        </div>
        <Link href="/buy">
          <Button variant="outline">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Search by Location
          </Button>
        </Link>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-6">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      )}

      {/* Listings grid */}
      <ListingsGrid
        listings={filteredListings}
        isLoading={isLoading}
        emptyMessage={
          selectedCategory
            ? `No ${selectedCategory} listings available`
            : 'No listings available yet'
        }
      />
    </div>
  );
}
