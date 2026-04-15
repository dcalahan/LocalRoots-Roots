'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GardenPlant, GardenBed, GardenAction, MyGardenData, BedType } from '@/types/my-garden';
import { getCropGrowingInfo, isValidCrop } from '@/lib/plantingCalendar';

const STORAGE_VERSION = 2;

function getStorageKey(userId: string): string {
  return `localroots-my-garden-${userId}`;
}

interface LoadedState {
  plants: GardenPlant[];
  beds: GardenBed[];
}

function loadFromLocal(userId: string): LoadedState {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { plants: [], beds: [] };
    const data = JSON.parse(raw) as MyGardenData;
    // v1 → v2 migration: keep plants, init empty beds
    return {
      plants: data.plants || [],
      beds: data.beds || [],
    };
  } catch {
    return { plants: [], beds: [] };
  }
}

function saveToLocal(userId: string, plants: GardenPlant[], beds: GardenBed[]): void {
  try {
    const data: MyGardenData = { version: STORAGE_VERSION, plants, beds };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
  } catch { /* quota exceeded — non-critical */ }
}

function findBedByFuzzyName(beds: GardenBed[], name: string): GardenBed | undefined {
  const lower = name.toLowerCase().trim();
  // exact match first
  let match = beds.find(b => b.name.toLowerCase() === lower);
  if (match) return match;
  // contains match
  match = beds.find(b => b.name.toLowerCase().includes(lower) || lower.includes(b.name.toLowerCase()));
  return match;
}

interface GardenState {
  plants: GardenPlant[];
  beds: GardenBed[];
}

export function useMyGarden(userId: string | null) {
  const [state, setState] = useState<GardenState>({ plants: [], beds: [] });
  const [isLoading, setIsLoading] = useState(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (!userId) {
      setState({ plants: [], beds: [] });
      setIsLoading(false);
      return;
    }

    const local = loadFromLocal(userId);
    if (local.plants.length > 0 || local.beds.length > 0) {
      setState(local);
      setIsLoading(false);
    } else {
      // Try cloud recovery
      fetch(`/api/my-garden?userId=${userId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.plants?.length > 0 || data?.beds?.length > 0) {
            const recovered = { plants: data.plants || [], beds: data.beds || [] };
            setState(recovered);
            saveToLocal(userId, recovered.plants, recovered.beds);
          }
        })
        .catch(() => { /* cloud down — fine */ })
        .finally(() => setIsLoading(false));
    }
  }, [userId]);

  // Debounced cloud sync
  const syncToCloud = useCallback((updatedPlants: GardenPlant[], updatedBeds: GardenBed[]) => {
    if (!userId) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/my-garden', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plants: updatedPlants, beds: updatedBeds }),
      }).catch(() => { /* non-critical */ });
    }, 2000);
  }, [userId]);

  const updateState = useCallback((
    updater: (prev: GardenState) => GardenState
  ) => {
    setState(prev => {
      const next = updater(prev);
      if (userId) {
        saveToLocal(userId, next.plants, next.beds);
        syncToCloud(next.plants, next.beds);
      }
      return next;
    });
  }, [userId, syncToCloud]);

  const { plants, beds } = state;

  // Add plants (bulk)
  const addPlants = useCallback((newPlants: Omit<GardenPlant, 'id' | 'createdAt' | 'year'>[]) => {
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const toAdd: GardenPlant[] = newPlants.map(p => ({
      ...p,
      id: crypto.randomUUID(),
      createdAt: now,
      year,
    }));
    updateState(prev => ({ ...prev, plants: [...prev.plants, ...toAdd] }));
    return toAdd;
  }, [updateState]);

  // Remove a plant
  const removePlant = useCallback((plantId: string) => {
    updateState(prev => ({
      ...prev,
      plants: prev.plants.map(p =>
        p.id === plantId ? { ...p, removedDate: new Date().toISOString() } : p
      ),
    }));
  }, [updateState]);

  // Mark a plant as harvested
  const markHarvested = useCallback((plantId: string) => {
    updateState(prev => ({
      ...prev,
      plants: prev.plants.map(p =>
        p.id === plantId ? { ...p, harvestedDate: new Date().toISOString() } : p
      ),
    }));
  }, [updateState]);

  // Update a plant's fields
  const updatePlant = useCallback((plantId: string, updates: Partial<GardenPlant>) => {
    updateState(prev => ({
      ...prev,
      plants: prev.plants.map(p =>
        p.id === plantId ? { ...p, ...updates } : p
      ),
    }));
  }, [updateState]);

  // Assign a plant to a bed
  const assignPlantToBed = useCallback((plantId: string, bedId: string | undefined) => {
    updateState(prev => ({
      ...prev,
      plants: prev.plants.map(p =>
        p.id === plantId ? { ...p, bedId } : p
      ),
    }));
  }, [updateState]);

  // ─── Bed CRUD ───
  const addBed = useCallback((bed: Omit<GardenBed, 'id' | 'createdAt' | 'order'>) => {
    const newBed: GardenBed = {
      ...bed,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      order: 0, // overwritten in updater
    };
    updateState(prev => ({
      ...prev,
      beds: [...prev.beds, { ...newBed, order: prev.beds.length }],
    }));
    return newBed;
  }, [updateState]);

  const updateBed = useCallback((bedId: string, updates: Partial<GardenBed>) => {
    updateState(prev => ({
      ...prev,
      beds: prev.beds.map(b => (b.id === bedId ? { ...b, ...updates } : b)),
    }));
  }, [updateState]);

  const deleteBed = useCallback((bedId: string) => {
    updateState(prev => ({
      // unassign plants in this bed
      plants: prev.plants.map(p => (p.bedId === bedId ? { ...p, bedId: undefined } : p)),
      beds: prev.beds.filter(b => b.id !== bedId),
    }));
  }, [updateState]);

  // Apply AI-generated garden actions
  const applyActions = useCallback((actions: GardenAction[]) => {
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    updateState(prev => {
      let updatedPlants = [...prev.plants];
      let updatedBeds = [...prev.beds];

      for (const action of actions) {
        switch (action.action) {
          case 'add_plant': {
            if (!action.cropId || !isValidCrop(action.cropId)) break;
            const cropInfo = getCropGrowingInfo(action.cropId);
            // Resolve bed: by id, by name fuzzy match
            let bedId = action.bedId;
            if (!bedId && action.bedName) {
              bedId = findBedByFuzzyName(updatedBeds, action.bedName)?.id;
            }
            const exists = updatedPlants.some(p =>
              p.cropId === action.cropId
              && !p.removedDate
              && Math.abs(new Date(p.plantingDate).getTime() - new Date(action.plantingDate || now).getTime()) < 86400000
            );
            if (!exists) {
              updatedPlants.push({
                id: crypto.randomUUID(),
                cropId: action.cropId,
                customVarietyName: action.customVarietyName,
                plantingDate: action.plantingDate || now.split('T')[0],
                quantity: action.quantity || 1,
                plantingMethod: action.method || 'transplant',
                bedId,
                location: action.location,
                notes: action.notes,
                isPerennial: cropInfo?.isPerennial || false,
                createdAt: now,
                year,
              });
            }
            break;
          }
          case 'remove_plant': {
            if (!action.cropId) break;
            const plant = updatedPlants.find(p => p.cropId === action.cropId && !p.removedDate);
            if (plant) {
              updatedPlants = updatedPlants.map(p =>
                p.id === plant.id ? { ...p, removedDate: now, notes: action.reason ? `${p.notes || ''} (${action.reason})`.trim() : p.notes } : p
              );
            }
            break;
          }
          case 'mark_harvested': {
            if (!action.cropId) break;
            const plant = updatedPlants.find(p => p.cropId === action.cropId && !p.harvestedDate && !p.removedDate);
            if (plant) {
              updatedPlants = updatedPlants.map(p =>
                p.id === plant.id ? { ...p, harvestedDate: now } : p
              );
            }
            break;
          }
          case 'update_plant': {
            if (!action.cropId) break;
            const plant = updatedPlants.find(p => p.cropId === action.cropId && !p.removedDate);
            if (plant && action.field && action.value) {
              const allowedFields = ['location', 'notes', 'quantity'];
              if (allowedFields.includes(action.field)) {
                updatedPlants = updatedPlants.map(p =>
                  p.id === plant.id ? { ...p, [action.field!]: action.field === 'quantity' ? parseInt(action.value!) : action.value } : p
                );
              }
            }
            break;
          }
          case 'add_bed': {
            if (!action.bedName) break;
            // skip if a similarly-named bed exists
            if (findBedByFuzzyName(updatedBeds, action.bedName)) break;
            updatedBeds.push({
              id: crypto.randomUUID(),
              name: action.bedName,
              type: (action.bedType as BedType) || 'raised-bed',
              widthInches: action.widthInches,
              lengthInches: action.lengthInches,
              createdAt: now,
              order: updatedBeds.length,
            });
            break;
          }
          case 'update_bed': {
            const target = action.bedId
              ? updatedBeds.find(b => b.id === action.bedId)
              : action.bedName
                ? findBedByFuzzyName(updatedBeds, action.bedName)
                : undefined;
            if (target && action.field && action.value !== undefined) {
              const allowed = ['name', 'notes', 'type'];
              if (allowed.includes(action.field)) {
                updatedBeds = updatedBeds.map(b =>
                  b.id === target.id ? { ...b, [action.field!]: action.value } : b
                );
              }
            }
            break;
          }
          case 'delete_bed': {
            const target = action.bedId
              ? updatedBeds.find(b => b.id === action.bedId)
              : action.bedName
                ? findBedByFuzzyName(updatedBeds, action.bedName)
                : undefined;
            if (target) {
              updatedPlants = updatedPlants.map(p =>
                p.bedId === target.id ? { ...p, bedId: undefined } : p
              );
              updatedBeds = updatedBeds.filter(b => b.id !== target.id);
            }
            break;
          }
          case 'assign_plant_to_bed': {
            if (!action.cropId) break;
            const bed = action.bedId
              ? updatedBeds.find(b => b.id === action.bedId)
              : action.bedName
                ? findBedByFuzzyName(updatedBeds, action.bedName)
                : undefined;
            if (!bed) break;
            const plant = updatedPlants.find(p => p.cropId === action.cropId && !p.removedDate);
            if (plant) {
              updatedPlants = updatedPlants.map(p =>
                p.id === plant.id ? { ...p, bedId: bed.id } : p
              );
            }
            break;
          }
        }
      }

      return { plants: updatedPlants, beds: updatedBeds };
    });
  }, [updateState]);

  // Active plants (not removed/harvested)
  const activePlants = plants.filter(p => !p.removedDate && !p.harvestedDate);

  return {
    plants,
    activePlants,
    beds,
    isLoading,
    addPlants,
    removePlant,
    markHarvested,
    updatePlant,
    assignPlantToBed,
    addBed,
    updateBed,
    deleteBed,
    applyActions,
  };
}
