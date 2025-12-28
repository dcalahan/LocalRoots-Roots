'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getAllProduce,
  getCategories,
  searchProduce,
  formatCategoryName,
  getInSeasonProduce,
} from '@/lib/produce';
import type { ProduceItem } from '@/lib/produce';

interface ProduceSelectorProps {
  onSelect: (produce: ProduceItem) => void;
  selectedId?: string;
}

export function ProduceSelector({ onSelect, selectedId }: ProduceSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showInSeason, setShowInSeason] = useState(false);

  const categories = useMemo(() => getCategories(), []);
  const allProduce = useMemo(() => getAllProduce(), []);
  const inSeasonProduce = useMemo(() => getInSeasonProduce(), []);

  const filteredProduce = useMemo(() => {
    let items = showInSeason ? inSeasonProduce : allProduce;

    if (selectedCategory) {
      items = items.filter((p) => p.category === selectedCategory);
    }

    if (search.trim()) {
      const searchResults = searchProduce(search);
      items = items.filter((p) => searchResults.some((s) => s.id === p.id));
    }

    return items;
  }, [allProduce, inSeasonProduce, selectedCategory, search, showInSeason]);

  const selectedProduce = useMemo(
    () => allProduce.find((p) => p.id === selectedId),
    [allProduce, selectedId]
  );

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="produce-search">Search Produce</Label>
        <Input
          id="produce-search"
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowInSeason(!showInSeason)}
          className={`
            px-3 py-1 text-sm rounded-full border transition-colors
            ${showInSeason
              ? 'bg-roots-secondary text-white border-roots-secondary'
              : 'border-gray-300 text-gray-600 hover:border-roots-secondary'
            }
          `}
        >
          In Season
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`
            px-3 py-1 text-sm rounded-full border transition-colors
            ${selectedCategory === null
              ? 'bg-roots-primary text-white border-roots-primary'
              : 'border-gray-300 text-gray-600 hover:border-roots-primary'
            }
          `}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`
              px-3 py-1 text-sm rounded-full border transition-colors
              ${selectedCategory === cat
                ? 'bg-roots-primary text-white border-roots-primary'
                : 'border-gray-300 text-gray-600 hover:border-roots-primary'
              }
            `}
          >
            {formatCategoryName(cat)}
          </button>
        ))}
      </div>

      {selectedProduce && (
        <div className="p-3 bg-roots-cream rounded-lg border border-roots-secondary">
          <div className="flex items-center gap-3">
            <img
              src={selectedProduce.image}
              alt={selectedProduce.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div>
              <p className="font-medium">{selectedProduce.name}</p>
              <p className="text-sm text-roots-gray">
                {formatCategoryName(selectedProduce.category)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(selectedProduce)}
              className="ml-auto text-sm text-roots-gray hover:text-red-600"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {!selectedProduce && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
          {filteredProduce.map((produce) => (
            <button
              key={produce.id}
              type="button"
              onClick={() => onSelect(produce)}
              className={`
                p-2 rounded-lg border text-left transition-all hover:border-roots-primary
                ${selectedId === produce.id
                  ? 'border-roots-primary bg-roots-cream'
                  : 'border-gray-200 bg-white'
                }
              `}
            >
              <img
                src={produce.image}
                alt={produce.name}
                className="w-full h-16 object-cover rounded mb-2"
              />
              <p className="text-sm font-medium truncate">{produce.name}</p>
              <p className="text-xs text-roots-gray truncate">
                {formatCategoryName(produce.category)}
              </p>
            </button>
          ))}
        </div>
      )}

      {filteredProduce.length === 0 && (
        <p className="text-center text-roots-gray py-4">
          No produce found. Try a different search.
        </p>
      )}
    </div>
  );
}
