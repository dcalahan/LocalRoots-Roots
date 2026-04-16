'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { PlantingMethod, CommunityVariety, GardenBed, GardenPlant } from '@/types/my-garden';
import { getAllGrowableCropIds, getCropGrowingInfo, POPULAR_CROPS } from '@/lib/plantingCalendar';

interface SelectedCrop {
  cropId: string;
  name: string;
  quantity: number;
  plantingDate: string;
  plantingMethod: PlantingMethod;
  location: string;
  customVarietyName?: string;
}

interface AddPlantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (plants: { cropId: string; quantity: number; plantingDate: string; plantingMethod: PlantingMethod; location?: string; isPerennial: boolean; bedId?: string; customVarietyName?: string }[]) => void;
  defaultBedId?: string;
  bedName?: string;
  userId?: string;
  /** When defaultBedId is not set, show a bed picker built from this list. */
  beds?: GardenBed[];
  /** Existing plants in the user's garden — used to surface "Your Varieties" at the top. */
  existingPlants?: GardenPlant[];
}

// Cache community varieties in localStorage
const VARIETY_CACHE_KEY = 'localroots-variety-registry';
const VARIETY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function getCachedVarieties(): CommunityVariety[] {
  try {
    const raw = localStorage.getItem(VARIETY_CACHE_KEY);
    if (!raw) return [];
    const { varieties, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt > VARIETY_CACHE_TTL) return [];
    return varieties || [];
  } catch { return []; }
}

function setCachedVarieties(varieties: CommunityVariety[]) {
  try {
    localStorage.setItem(VARIETY_CACHE_KEY, JSON.stringify({ varieties, fetchedAt: Date.now() }));
  } catch { /* quota */ }
}

export function AddPlantsModal({ isOpen, onClose, onAdd, defaultBedId, bedName, userId, beds = [], existingPlants = [] }: AddPlantsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedCrop[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customParentSearch, setCustomParentSearch] = useState('');
  const [communityVarieties, setCommunityVarieties] = useState<CommunityVariety[]>([]);
  // Bed selection — used when defaultBedId is not provided. If user has 1 bed,
  // default to that. If 2+, leave blank and require selection. If 0, undefined.
  const [chosenBedId, setChosenBedId] = useState<string | undefined>(() => {
    if (defaultBedId) return defaultBedId;
    if (beds.length === 1) return beds[0].id;
    return undefined;
  });
  // Re-sync if props change while modal is open
  useEffect(() => {
    if (defaultBedId) setChosenBedId(defaultBedId);
    else if (beds.length === 1) setChosenBedId(beds[0].id);
  }, [defaultBedId, beds]);

  const showBedPicker = !defaultBedId && beds.length > 0;
  const effectiveBedId = defaultBedId || chosenBedId;

  const today = new Date().toISOString().split('T')[0];
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Load community varieties
  useEffect(() => {
    if (!isOpen) return;
    const cached = getCachedVarieties();
    setCommunityVarieties(cached);
    // Background refresh
    fetch('/api/variety-registry')
      .then(r => r.json())
      .then(data => {
        if (data.varieties) {
          setCommunityVarieties(data.varieties);
          setCachedVarieties(data.varieties);
        }
      })
      .catch(() => { /* offline — use cache */ });
  }, [isOpen]);

  // Build standard crop list. When the user is searching, ALWAYS search the
  // full library — typing a crop name and only matching the popular subset is
  // confusing ("Or" should find Oregano, Oranges, etc. without toggling).
  const allCrops = useMemo(() => {
    const isSearching = search.trim().length > 0;
    const ids = isSearching || showAll ? getAllGrowableCropIds() : POPULAR_CROPS;
    return ids
      .map(id => {
        const info = getCropGrowingInfo(id);
        return info ? { id, name: info.name, category: info.category, isPerennial: info.isPerennial } : null;
      })
      .filter(Boolean) as { id: string; name: string; category: string; isPerennial: boolean }[];
  }, [showAll, search]);

  // Full crop list for parent picker (always all)
  const allCropsForParent = useMemo(() => {
    return getAllGrowableCropIds()
      .map(id => {
        const info = getCropGrowingInfo(id);
        return info ? { id, name: info.name } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, []);

  // Category display config
  const CATEGORY_ORDER: Record<string, { label: string; emoji: string }> = {
    'my-varieties': { label: 'Your Varieties', emoji: '⭐' },
    'nightshades': { label: 'Nightshades', emoji: '🍅' },
    'leafy-greens': { label: 'Leafy Greens', emoji: '🥬' },
    'herbs': { label: 'Herbs', emoji: '🌿' },
    'root-vegetables': { label: 'Root Vegetables', emoji: '🥕' },
    'squash': { label: 'Squash & Cucurbits', emoji: '🥒' },
    'brassicas': { label: 'Brassicas', emoji: '🥦' },
    'legumes': { label: 'Legumes', emoji: '🫘' },
    'alliums': { label: 'Alliums', emoji: '🧅' },
    'berries': { label: 'Berries', emoji: '🫐' },
    'tree-fruits': { label: 'Tree Fruits', emoji: '🍎' },
    'other': { label: 'Other', emoji: '🌱' },
    'community': { label: 'Community Varieties', emoji: '👥' },
  };

  // Extract the user's own custom varieties from their existing plants.
  // These appear at the top of the browse view so they're always accessible
  // without searching (e.g. "Mojito Mint" shows up immediately).
  const myVarieties = useMemo(() => {
    const seen = new Set<string>();
    const results: { id: string; name: string; category: string; isPerennial: boolean; isCommunity: true; parentCropId: string; description?: string }[] = [];
    for (const plant of existingPlants) {
      if (plant.customVarietyName && !seen.has(plant.customVarietyName.toLowerCase())) {
        seen.add(plant.customVarietyName.toLowerCase());
        const parentInfo = getCropGrowingInfo(plant.cropId);
        results.push({
          id: `my-variety:${plant.cropId}:${plant.customVarietyName}`,
          name: plant.customVarietyName,
          category: 'my-varieties',
          isPerennial: parentInfo?.isPerennial || false,
          isCommunity: true,
          parentCropId: plant.cropId,
        });
      }
    }
    return results;
  }, [existingPlants]);

  // Merge standard crops + community varieties for search
  const filteredCrops = useMemo(() => {
    const lower = search.toLowerCase().trim();
    const standard = lower
      ? allCrops.filter(c => c.name.toLowerCase().includes(lower) || c.id.includes(lower))
      : allCrops;

    // Community varieties matching search (include user's own + registry)
    let communityMatches: typeof myVarieties = [];
    if (lower.length >= 2) {
      communityMatches = communityVarieties
        .filter(v => v.name.toLowerCase().includes(lower))
        .map(v => ({
          id: `community:${v.id}:${v.parentCropId}`,
          name: v.name,
          category: 'community' as const,
          isPerennial: getCropGrowingInfo(v.parentCropId)?.isPerennial || false,
          isCommunity: true as const,
          parentCropId: v.parentCropId,
          description: v.description,
        }));
    }

    // When searching, also include user's own varieties that match
    const myMatches = lower
      ? myVarieties.filter(v => v.name.toLowerCase().includes(lower))
      : myVarieties;

    // Deduplicate: my varieties win over community registry
    const myNames = new Set(myMatches.map(v => v.name.toLowerCase()));
    const dedupedCommunity = communityMatches.filter(v => !myNames.has(v.name.toLowerCase()));

    return [...myMatches, ...dedupedCommunity, ...standard];
  }, [allCrops, communityVarieties, myVarieties, search]);

  // Group crops by category
  const groupedCrops = useMemo(() => {
    const groups: Record<string, typeof filteredCrops> = {};
    for (const crop of filteredCrops) {
      const cat = crop.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(crop);
    }
    // Sort by defined order
    const ordered = Object.keys(CATEGORY_ORDER)
      .filter(cat => groups[cat]?.length)
      .map(cat => ({ category: cat, ...CATEGORY_ORDER[cat], crops: groups[cat] }));
    // Add any unknown categories
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER[cat]) {
        ordered.push({ category: cat, label: cat, emoji: '🌱', crops: groups[cat] });
      }
    }
    return ordered;
  }, [filteredCrops]);

  // Parent picker filtering
  const filteredParents = useMemo(() => {
    if (!customParentSearch.trim()) return allCropsForParent;
    const lower = customParentSearch.toLowerCase();
    return allCropsForParent.filter(c => c.name.toLowerCase().includes(lower));
  }, [allCropsForParent, customParentSearch]);

  const toggleCrop = (crop: { id: string; name: string; isCommunity?: boolean; parentCropId?: string }) => {
    if (crop.isCommunity && crop.parentCropId) {
      // Community variety — set customVarietyName + real cropId
      const key = crop.id; // "community:slug:parentCropId"
      setSelected(prev => {
        const exists = prev.find(s => s.cropId === key);
        if (exists) return prev.filter(s => s.cropId !== key);
        return [...prev, {
          cropId: crop.parentCropId!,
          name: crop.name,
          customVarietyName: crop.name,
          quantity: 1,
          plantingDate: today,
          plantingMethod: 'transplant' as PlantingMethod,
          location: '',
        }];
      });
    } else {
      setSelected(prev => {
        const exists = prev.find(s => s.cropId === crop.id && !s.customVarietyName);
        if (exists) return prev.filter(s => !(s.cropId === crop.id && !s.customVarietyName));
        return [...prev, {
          cropId: crop.id,
          name: crop.name,
          quantity: 1,
          plantingDate: today,
          plantingMethod: 'transplant' as PlantingMethod,
          location: '',
        }];
      });
    }
  };

  const addCustomVariety = (parentCropId: string) => {
    const parentInfo = getCropGrowingInfo(parentCropId);
    const trimmed = customName.trim();
    if (!trimmed) return;

    setSelected(prev => [...prev, {
      cropId: parentCropId,
      name: trimmed,
      customVarietyName: trimmed,
      quantity: 1,
      plantingDate: today,
      plantingMethod: 'transplant' as PlantingMethod,
      location: '',
    }]);

    // Register to community variety pool
    if (userId) {
      fetch('/api/variety-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, parentCropId, userId }),
      }).catch(() => { /* non-critical */ });
    }

    setCustomMode(false);
    setCustomName('');
    setCustomParentSearch('');
  };

  const updateSelected = (idx: number, updates: Partial<SelectedCrop>) => {
    setSelected(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
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
        bedId: effectiveBedId,
        customVarietyName: s.customVarietyName,
      };
    }));
    setSelected([]);
    setSearch('');
    setStep(1);
    setShowAll(false);
    setCustomMode(false);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    setSearch('');
    setStep(1);
    setShowAll(false);
    setCustomMode(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col shadow-2xl"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {customMode
              ? 'Add Custom Variety'
              : step === 1
                ? (bedName ? `Add Plants to ${bedName}` : 'Add Plants to Garden')
                : `Configure ${selected.length} Plant${selected.length > 1 ? 's' : ''}`
            }
          </h2>
          <button onClick={handleClose} className="text-roots-gray hover:text-gray-900 text-xl leading-none p-1">✕</button>
        </div>

        {customMode ? (
          <>
            {/* Custom variety flow */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="space-y-4">
                {/* Variety name */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-1">Variety name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Better Boy, Mojito Mint, Sun Gold"
                    maxLength={80}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary"
                    style={{ fontSize: 'max(16px, 0.875rem)' }}
                    autoFocus
                  />
                </div>

                {/* Parent crop picker */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-1">
                    What type of plant is this closest to?
                  </label>
                  <p className="text-xs text-roots-gray mb-2">
                    This gives your plant accurate growing timelines and harvest estimates.
                  </p>
                  <input
                    type="text"
                    value={customParentSearch}
                    onChange={e => setCustomParentSearch(e.target.value)}
                    placeholder="Search parent crop..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary mb-2"
                    style={{ fontSize: 'max(16px, 0.875rem)' }}
                  />
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {filteredParents.map(crop => (
                      <button
                        key={crop.id}
                        onClick={() => addCustomVariety(crop.id)}
                        disabled={!customName.trim()}
                        className="text-left px-3 py-3 rounded-lg text-sm bg-gray-50 border-2 border-transparent hover:bg-roots-secondary/5 text-gray-700 touch-manipulation disabled:opacity-40"
                      >
                        {crop.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t shrink-0">
              <button
                onClick={() => { setCustomMode(false); setCustomName(''); setCustomParentSearch(''); }}
                className="w-full py-3 rounded-xl font-semibold text-roots-secondary border-2 border-roots-secondary/40 hover:bg-roots-secondary/10 transition-colors"
              >
                ← Back to crop list
              </button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b shrink-0">
              {showBedPicker && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-roots-gray block mb-1.5">
                    Add to which bed?
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {beds.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setChosenBedId(b.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          chosenBedId === b.id
                            ? 'bg-roots-secondary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setChosenBedId(undefined)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        chosenBedId === undefined
                          ? 'bg-roots-gray text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      No bed
                    </button>
                  </div>
                </div>
              )}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search crops or varieties..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-roots-secondary focus:ring-1 focus:ring-roots-secondary"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-xs text-roots-secondary hover:underline"
                  >
                    {showAll ? '← Popular' : 'All 90+'}
                  </button>
                  <button
                    onClick={() => { setCustomMode(true); setCustomName(search); }}
                    className="text-xs text-roots-primary hover:underline"
                  >
                    + Custom variety
                  </button>
                </div>
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
                <div className="text-center py-8">
                  <p className="text-sm text-roots-gray mb-3">
                    No crops match &ldquo;{search}&rdquo;
                  </p>
                  <button
                    onClick={() => { setCustomMode(true); setCustomName(search); }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-roots-primary hover:bg-roots-primary/90 transition-colors"
                  >
                    Add &ldquo;{search}&rdquo; as custom variety
                  </button>
                </div>
              ) : search.trim() ? (
                /* Flat grid when searching */
                <div className="grid grid-cols-2 gap-2">
                  {filteredCrops.map(crop => {
                    const isCommunity = 'isCommunity' in crop && !!(crop as Record<string, unknown>).isCommunity;
                    const isSelected = isCommunity
                      ? selected.some(s => s.customVarietyName === crop.name)
                      : selected.some(s => s.cropId === crop.id && !s.customVarietyName);
                    return (
                      <button
                        key={crop.id}
                        onClick={() => toggleCrop(crop as Parameters<typeof toggleCrop>[0])}
                        className={`text-left px-3 py-3 rounded-lg text-sm transition-colors touch-manipulation ${
                          isSelected
                            ? 'bg-roots-secondary/20 border-2 border-roots-secondary text-roots-secondary font-medium'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-roots-secondary/5 text-gray-700'
                        }`}
                      >
                        {crop.name}
                        {isCommunity && crop.category !== 'my-varieties' && (
                          <span className="block text-xs text-roots-primary/70 mt-0.5">community</span>
                        )}
                        {crop.category === 'my-varieties' && (
                          <span className="block text-xs text-roots-secondary/70 mt-0.5">
                            {getCropGrowingInfo(('parentCropId' in crop ? (crop as Record<string, unknown>).parentCropId : crop.id) as string)?.name || ''}
                          </span>
                        )}
                        {'isPerennial' in crop && crop.isPerennial && !isCommunity && (
                          <span className="text-xs text-roots-gray ml-1">(perennial)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Category-grouped browsing */
                <div className="space-y-4">
                  {groupedCrops.map(group => (
                    <div key={group.category}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-roots-gray mb-2 flex items-center gap-1.5">
                        <span>{group.emoji}</span> {group.label}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {group.crops.map(crop => {
                          const isCommunity = 'isCommunity' in crop && !!(crop as Record<string, unknown>).isCommunity;
                          const isSelected = isCommunity
                            ? selected.some(s => s.customVarietyName === crop.name)
                            : selected.some(s => s.cropId === crop.id && !s.customVarietyName);
                          return (
                            <button
                              key={crop.id}
                              onClick={() => toggleCrop(crop as Parameters<typeof toggleCrop>[0])}
                              className={`text-left px-3 py-3 rounded-lg text-sm transition-colors touch-manipulation ${
                                isSelected
                                  ? 'bg-roots-secondary/20 border-2 border-roots-secondary text-roots-secondary font-medium'
                                  : 'bg-gray-50 border-2 border-transparent hover:bg-roots-secondary/5 text-gray-700'
                              }`}
                            >
                              {crop.name}
                              {isCommunity && crop.category !== 'my-varieties' && (
                                <span className="block text-xs text-roots-primary/70 mt-0.5">community</span>
                              )}
                              {crop.category === 'my-varieties' && (
                                <span className="block text-xs text-roots-secondary/70 mt-0.5">
                                  {getCropGrowingInfo(('parentCropId' in crop ? (crop as Record<string, unknown>).parentCropId : crop.id) as string)?.name || ''}
                                </span>
                              )}
                              {'isPerennial' in crop && crop.isPerennial && !isCommunity && (
                                <span className="text-xs text-roots-gray ml-1">(perennial)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                {selected.map((s, idx) => (
                  <div key={`${s.cropId}-${s.customVarietyName || idx}`} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{s.customVarietyName || s.name}</span>
                        {s.customVarietyName && (
                          <span className="text-xs text-roots-gray ml-1">({s.name})</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelected(prev => {
                          const next = prev.filter((_, i) => i !== idx);
                          if (next.length === 0) setStep(1);
                          return next;
                        })}
                        className="text-xs text-roots-gray hover:text-red-500 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-roots-gray block mb-1">How many?</label>
                        <QuantityInput
                          value={s.quantity}
                          onChange={val => updateSelected(idx, { quantity: val })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-roots-gray block mb-1">Method</label>
                        <select
                          value={s.plantingMethod}
                          onChange={e => updateSelected(idx, { plantingMethod: e.target.value as PlantingMethod })}
                          className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                          style={{ fontSize: 'max(16px, 0.875rem)' }}
                        >
                          <option value="transplant">Transplant</option>
                          <option value="direct-sow">Direct sow</option>
                          <option value="start-indoors">Start indoors</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-roots-gray block mb-1">When did you plant?</label>
                      <input
                        type="date"
                        value={s.plantingDate}
                        max={today}
                        onChange={e => updateSelected(idx, { plantingDate: e.target.value })}
                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        style={{ fontSize: 'max(16px, 0.875rem)' }}
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => updateSelected(idx, { plantingDate: today })}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            s.plantingDate === today ? 'bg-roots-secondary/20 text-roots-secondary' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => {
                            const d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
                            updateSelected(idx, { plantingDate: d });
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                        >
                          1 week ago
                        </button>
                        <button
                          onClick={() => updateSelected(idx, { plantingDate: threeWeeksAgo })}
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
      onFocus={() => { setTimeout(() => ref.current?.select(), 0); }}
      onChange={e => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        setRaw(v);
        const num = parseInt(v, 10);
        if (num > 0) onChange(num);
      }}
      onBlur={() => {
        const num = parseInt(raw, 10);
        if (!num || num < 1) { setRaw('1'); onChange(1); }
      }}
      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center"
      style={{ fontSize: 'max(16px, 0.875rem)' }}
    />
  );
}
