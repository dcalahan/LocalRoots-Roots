'use client';

import { useState, useMemo } from 'react';
import type { PlantingMethod } from '@/types/my-garden';
import { getAllGrowableCropIds, getCropGrowingInfo, POPULAR_CROPS } from '@/lib/plantingCalendar';

interface SelectedCrop {
  cropId: string;
  name: string;
  quantity: number;
  plantingDate: string;
  plantingMethod: PlantingMethod;
  location: string;
}

interface AddPlantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (plants: { cropId: string; quantity: number; plantingDate: string; plantingMethod: PlantingMethod; location?: string; isPerennial: boolean }[]) => void;
}

export function AddPlantsModal({ isOpen, onClose, onAdd }: AddPlantsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedCrop[]>([]);
  const [showAll, setShowAll] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Build crop list
  const allCrops = useMemo(() => {
    const ids = showAll ? getAllGrowableCropIds() : POPULAR_CROPS;
    return ids
      .map(id => {
        const info = getCropGrowingInfo(id);
        return info ? { id, name: info.name, category: info.category, isPerennial: info.isPerennial } : null;
      })
      .filter(Boolean) as { id: string; name: string; category: string; isPerennial: boolean }[];
  }, [showAll]);

  const filteredCrops = useMemo(() => {
    if (!search.trim()) return allCrops;
    const lower = search.toLowerCase();
    return allCrops.filter(c => c.name.toLowerCase().includes(lower) || c.id.includes(lower));
  }, [allCrops, search]);

  const toggleCrop = (crop: { id: string; name: string }) => {
    setSelected(prev => {
      const exists = prev.find(s => s.cropId === crop.id);
      if (exists) return prev.filter(s => s.cropId !== crop.id);
      return [...prev, {
        cropId: crop.id,
        name: crop.name,
        quantity: 1,
        plantingDate: today,
        plantingMethod: 'transplant' as PlantingMethod,
        location: '',
      }];
    });
  };

  const updateSelected = (cropId: string, updates: Partial<SelectedCrop>) => {
    setSelected(prev => prev.map(s => s.cropId === cropId ? { ...s, ...updates } : s));
  };

  const handleAdd = () => {
    if (selected.length === 0) return;
    onAdd(selected.map(s => {
      const info = getCropGrowingInfo(s.cropId);
      return {
        cropId: s.cropId,
        quantity: s.quantity,
        plantingDate: s.plantingDate,
        plantingMethod: s.plantingMethod,
        location: s.location || undefined,
        isPerennial: info?.isPerennial || false,
      };
    }));
    setSelected([]);
    setSearch('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Plants to Garden</h2>
          <button onClick={onClose} className="text-roots-gray hover:text-gray-900 text-xl">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search crops..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary"
            autoFocus
          />
          {!showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-2 text-xs text-roots-secondary hover:underline"
            >
              Show all 90+ crops
            </button>
          )}
        </div>

        {/* Crop list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredCrops.length === 0 ? (
            <p className="text-sm text-roots-gray text-center py-4">No crops found</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredCrops.map(crop => {
                const isSelected = selected.some(s => s.cropId === crop.id);
                return (
                  <button
                    key={crop.id}
                    onClick={() => toggleCrop(crop)}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-roots-secondary/20 border-2 border-roots-secondary text-roots-secondary font-medium'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-roots-secondary/5 text-gray-700'
                    }`}
                  >
                    {crop.name}
                    {crop.isPerennial && <span className="text-xs text-roots-gray ml-1">(perennial)</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected plants details */}
        {selected.length > 0 && (
          <div className="border-t px-4 py-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-roots-gray uppercase tracking-wide mb-2">
              {selected.length} plant{selected.length > 1 ? 's' : ''} selected
            </p>
            <div className="space-y-3">
              {selected.map(s => (
                <div key={s.cropId} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">{s.name}</span>
                  <input
                    type="number"
                    min={1}
                    value={s.quantity}
                    onChange={e => updateSelected(s.cropId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-14 px-2 py-1 border rounded text-center text-sm"
                  />
                  <select
                    value={s.plantingMethod}
                    onChange={e => updateSelected(s.cropId, { plantingMethod: e.target.value as PlantingMethod })}
                    className="px-2 py-1 border rounded text-sm text-gray-700"
                  >
                    <option value="transplant">Transplant</option>
                    <option value="direct-sow">Direct sow</option>
                    <option value="start-indoors">Start indoors</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t">
          <button
            onClick={handleAdd}
            disabled={selected.length === 0}
            className="w-full py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add {selected.length > 0 ? `${selected.length} Plant${selected.length > 1 ? 's' : ''}` : 'Plants'} to Garden
          </button>
        </div>
      </div>
    </div>
  );
}
