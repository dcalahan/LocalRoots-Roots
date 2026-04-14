'use client';

import { useState, useMemo, useRef } from 'react';
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
  onAdd: (plants: { cropId: string; quantity: number; plantingDate: string; plantingMethod: PlantingMethod; location?: string; isPerennial: boolean; bedId?: string }[]) => void;
  defaultBedId?: string;
  bedName?: string;
}

export function AddPlantsModal({ isOpen, onClose, onAdd, defaultBedId, bedName }: AddPlantsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedCrop[]>([]);
  const [showAll, setShowAll] = useState(false);
  // Step 1: pick crops, Step 2: configure details
  const [step, setStep] = useState<1 | 2>(1);

  const today = new Date().toISOString().split('T')[0];
  // Default to 3 weeks ago (common: "I planted these a few weeks ago")
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
        bedId: defaultBedId,
      };
    }));
    setSelected([]);
    setSearch('');
    setStep(1);
    setShowAll(false);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    setSearch('');
    setStep(1);
    setShowAll(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 1
              ? (bedName ? `Add Plants to ${bedName}` : 'Add Plants to Garden')
              : `Configure ${selected.length} Plant${selected.length > 1 ? 's' : ''}`
            }
          </h2>
          <button onClick={handleClose} className="text-roots-gray hover:text-gray-900 text-xl leading-none p-1">✕</button>
        </div>

        {step === 1 ? (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b shrink-0">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search crops..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-roots-secondary hover:underline"
                >
                  {showAll ? '← Show popular crops' : 'Show all 90+ crops'}
                </button>
                {selected.length > 0 && (
                  <span className="text-xs text-roots-secondary font-semibold">
                    {selected.length} selected
                  </span>
                )}
              </div>
            </div>

            {/* Crop grid */}
            <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                        className={`text-left px-3 py-3 rounded-lg text-sm transition-colors touch-manipulation ${
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

            {/* Footer: Next step */}
            <div className="px-4 py-3 border-t shrink-0">
              <button
                onClick={() => setStep(2)}
                disabled={selected.length === 0}
                className="w-full py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {selected.length > 0
                  ? `Next: Set Details for ${selected.length} Plant${selected.length > 1 ? 's' : ''}`
                  : 'Select Plants to Continue'
                }
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Configure each selected plant */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="space-y-4">
                {selected.map(s => (
                  <div key={s.cropId} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">{s.name}</span>
                      <button
                        onClick={() => setSelected(prev => {
                          const next = prev.filter(p => p.cropId !== s.cropId);
                          if (next.length === 0) setStep(1);
                          return next;
                        })}
                        className="text-xs text-roots-gray hover:text-red-500 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Quantity */}
                      <div>
                        <label className="text-xs text-roots-gray block mb-1">How many?</label>
                        <QuantityInput
                          value={s.quantity}
                          onChange={val => updateSelected(s.cropId, { quantity: val })}
                        />
                      </div>

                      {/* Method */}
                      <div>
                        <label className="text-xs text-roots-gray block mb-1">Method</label>
                        <select
                          value={s.plantingMethod}
                          onChange={e => updateSelected(s.cropId, { plantingMethod: e.target.value as PlantingMethod })}
                          className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                          style={{ fontSize: 'max(16px, 0.875rem)' }}
                        >
                          <option value="transplant">Transplant</option>
                          <option value="direct-sow">Direct sow</option>
                          <option value="start-indoors">Start indoors</option>
                        </select>
                      </div>
                    </div>

                    {/* Planting date */}
                    <div>
                      <label className="text-xs text-roots-gray block mb-1">When did you plant?</label>
                      <input
                        type="date"
                        value={s.plantingDate}
                        max={today}
                        onChange={e => updateSelected(s.cropId, { plantingDate: e.target.value })}
                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        style={{ fontSize: 'max(16px, 0.875rem)' }}
                      />
                      {/* Quick date shortcuts */}
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => updateSelected(s.cropId, { plantingDate: today })}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            s.plantingDate === today ? 'bg-roots-secondary/20 text-roots-secondary' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => {
                            const d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
                            updateSelected(s.cropId, { plantingDate: d });
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                        >
                          1 week ago
                        </button>
                        <button
                          onClick={() => updateSelected(s.cropId, { plantingDate: threeWeeksAgo })}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                        >
                          3 weeks ago
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer: Back + Add */}
            <div className="px-4 py-3 border-t shrink-0 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl font-semibold text-roots-secondary border-2 border-roots-secondary/40 hover:bg-roots-secondary/10 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors"
              >
                Add {selected.length} Plant{selected.length > 1 ? 's' : ''} to Garden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Quantity input that selects all on focus so "1" gets replaced, not appended. */
function QuantityInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState(String(value));

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={raw}
      onFocus={() => {
        // Select all text so typing replaces the value
        setTimeout(() => ref.current?.select(), 0);
      }}
      onChange={e => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        setRaw(v);
        const num = parseInt(v, 10);
        if (num > 0) onChange(num);
      }}
      onBlur={() => {
        // Ensure at least 1 on blur
        const num = parseInt(raw, 10);
        if (!num || num < 1) {
          setRaw('1');
          onChange(1);
        }
      }}
      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center"
      style={{ fontSize: 'max(16px, 0.875rem)' }}
    />
  );
}
