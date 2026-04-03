'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GardenPlant, GardenAction, MyGardenData } from '@/types/my-garden';
import { getCropGrowingInfo, isValidCrop } from '@/lib/plantingCalendar';

const STORAGE_VERSION = 1;

function getStorageKey(userId: string): string {
  return `localroots-my-garden-${userId}`;
}

function loadFromLocal(userId: string): GardenPlant[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw) as MyGardenData;
    if (data.version !== STORAGE_VERSION) return [];
    return data.plants || [];
  } catch {
    return [];
  }
}

function saveToLocal(userId: string, plants: GardenPlant[]): void {
  try {
    const data: MyGardenData = { version: STORAGE_VERSION, plants };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
  } catch { /* quota exceeded — non-critical */ }
}

export function useMyGarden(userId: string | null) {
  const [plants, setPlants] = useState<GardenPlant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (!userId) {
      setPlants([]);
      setIsLoading(false);
      return;
    }

    const local = loadFromLocal(userId);
    if (local.length > 0) {
      setPlants(local);
      setIsLoading(false);
    } else {
      // Try cloud recovery
      fetch(`/api/my-garden?userId=${userId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.plants?.length > 0) {
            setPlants(data.plants);
            saveToLocal(userId, data.plants);
          }
        })
        .catch(() => { /* cloud down — fine */ })
        .finally(() => setIsLoading(false));
    }
  }, [userId]);

  // Debounced cloud sync
  const syncToCloud = useCallback((updatedPlants: GardenPlant[]) => {
    if (!userId) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/my-garden', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plants: updatedPlants }),
      }).catch(() => { /* non-critical */ });
    }, 2000);
  }, [userId]);

  const updatePlants = useCallback((updater: (prev: GardenPlant[]) => GardenPlant[]) => {
    setPlants(prev => {
      const updated = updater(prev);
      if (userId) {
        saveToLocal(userId, updated);
        syncToCloud(updated);
      }
      return updated;
    });
  }, [userId, syncToCloud]);

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
    updatePlants(prev => [...prev, ...toAdd]);
    return toAdd;
  }, [updatePlants]);

  // Remove a plant
  const removePlant = useCallback((plantId: string) => {
    updatePlants(prev => prev.map(p =>
      p.id === plantId ? { ...p, removedDate: new Date().toISOString() } : p
    ));
  }, [updatePlants]);

  // Mark a plant as harvested
  const markHarvested = useCallback((plantId: string) => {
    updatePlants(prev => prev.map(p =>
      p.id === plantId ? { ...p, harvestedDate: new Date().toISOString() } : p
    ));
  }, [updatePlants]);

  // Update a plant's fields
  const updatePlant = useCallback((plantId: string, updates: Partial<GardenPlant>) => {
    updatePlants(prev => prev.map(p =>
      p.id === plantId ? { ...p, ...updates } : p
    ));
  }, [updatePlants]);

  // Apply AI-generated garden actions
  const applyActions = useCallback((actions: GardenAction[]) => {
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    updatePlants(prev => {
      let updated = [...prev];

      for (const action of actions) {
        if (!isValidCrop(action.cropId)) continue;

        switch (action.action) {
          case 'add_plant': {
            const cropInfo = getCropGrowingInfo(action.cropId);
            // Check if already exists with same crop + recent date to avoid duplicates
            const exists = updated.some(p =>
              p.cropId === action.cropId
              && !p.removedDate
              && Math.abs(new Date(p.plantingDate).getTime() - new Date(action.plantingDate || now).getTime()) < 86400000
            );
            if (!exists) {
              updated.push({
                id: crypto.randomUUID(),
                cropId: action.cropId,
                plantingDate: action.plantingDate || now.split('T')[0],
                quantity: action.quantity || 1,
                plantingMethod: action.method || 'transplant',
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
            const plant = updated.find(p => p.cropId === action.cropId && !p.removedDate);
            if (plant) {
              updated = updated.map(p =>
                p.id === plant.id ? { ...p, removedDate: now, notes: action.reason ? `${p.notes || ''} (${action.reason})`.trim() : p.notes } : p
              );
            }
            break;
          }
          case 'mark_harvested': {
            const plant = updated.find(p => p.cropId === action.cropId && !p.harvestedDate && !p.removedDate);
            if (plant) {
              updated = updated.map(p =>
                p.id === plant.id ? { ...p, harvestedDate: now } : p
              );
            }
            break;
          }
          case 'update_plant': {
            const plant = updated.find(p => p.cropId === action.cropId && !p.removedDate);
            if (plant && action.field && action.value) {
              const allowedFields = ['location', 'notes', 'quantity'];
              if (allowedFields.includes(action.field)) {
                updated = updated.map(p =>
                  p.id === plant.id ? { ...p, [action.field!]: action.field === 'quantity' ? parseInt(action.value!) : action.value } : p
                );
              }
            }
            break;
          }
        }
      }

      return updated;
    });
  }, [updatePlants]);

  // Active plants (not removed/harvested)
  const activePlants = plants.filter(p => !p.removedDate && !p.harvestedDate);

  return {
    plants,
    activePlants,
    isLoading,
    addPlants,
    removePlant,
    markHarvested,
    updatePlant,
    applyActions,
  };
}
