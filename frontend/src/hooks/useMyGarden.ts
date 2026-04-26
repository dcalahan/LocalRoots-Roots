'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GardenPlant, GardenBed, GardenAction, MyGardenData, BedType, PlantStatus } from '@/types/my-garden';
import { getCropGrowingInfo, isValidCrop } from '@/lib/plantingCalendar';
import { getDismissibleAlertIds, type CareCategory } from '@/lib/careDismissals';

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

// Mirror of careAlerts.ts's localStorage key — kept duplicated here so this
// hook can write dismissals without importing the React-coupled module.
const CARE_DISMISSALS_KEY = 'localroots:care-alert-dismissals';

/** Write care-alert dismissals to localStorage (instant UI) and server (KV mirror). */
function persistCareDismissals(alertIds: string[], userId: string | null): void {
  if (alertIds.length === 0) return;
  // localStorage: instant UI updates on plant cards
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CARE_DISMISSALS_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      const now = new Date().toISOString();
      for (const id of alertIds) map[id] = now;
      window.localStorage.setItem(CARE_DISMISSALS_KEY, JSON.stringify(map));
    } catch { /* quota or parse failure — non-critical */ }
  }
  // Server: so Sage's next system prompt sees the dismissal
  if (userId) {
    fetch(`/api/care-dismissals?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds }),
    }).catch(() => { /* localStorage already has it — non-critical */ });
  }
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

  // Reorder a plant within its bed
  const reorderPlant = useCallback((plantId: string, direction: 'up' | 'down') => {
    updateState(prev => {
      const plant = prev.plants.find(p => p.id === plantId);
      if (!plant?.bedId) return prev;

      // Get plants in this bed, sorted by current order
      const bedPlants = prev.plants
        .filter(p => p.bedId === plant.bedId && !p.removedDate && !p.harvestedDate)
        .sort((a, b) => (a.orderInBed ?? 999) - (b.orderInBed ?? 999));

      const idx = bedPlants.findIndex(p => p.id === plantId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === bedPlants.length - 1) return prev;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const swapId = bedPlants[swapIdx].id;

      // Assign new order values
      const orderMap = new Map<string, number>();
      bedPlants.forEach((p, i) => orderMap.set(p.id, i));
      orderMap.set(plantId, swapIdx);
      orderMap.set(swapId, idx);

      return {
        ...prev,
        plants: prev.plants.map(p => orderMap.has(p.id) ? { ...p, orderInBed: orderMap.get(p.id) } : p),
      };
    });
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
            // SAFETY: if Sage didn't extract a planting date, skip auto-adding the
            // plant. Better for Sage to ask the user "when did you plant it?" than
            // to create a plant with today's date that may be wrong by weeks. The
            // extraction prompt was updated to leave plantingDate off when the user
            // didn't say a date — this guard catches anything that slipped through.
            if (!action.plantingDate) {
              console.warn('[useMyGarden] Skipping add_plant without plantingDate:', action);
              break;
            }

            const cropInfo = getCropGrowingInfo(action.cropId);
            // Resolve bed: by id, by name fuzzy match
            let bedId = action.bedId;
            if (!bedId && action.bedName) {
              bedId = findBedByFuzzyName(updatedBeds, action.bedName)?.id;
            }
            const exists = updatedPlants.some(p =>
              p.cropId === action.cropId
              && !p.removedDate
              && Math.abs(new Date(p.plantingDate).getTime() - new Date(action.plantingDate!).getTime()) < 86400000
            );
            if (!exists) {
              updatedPlants.push({
                id: crypto.randomUUID(),
                cropId: action.cropId,
                customVarietyName: action.customVarietyName,
                plantingDate: action.plantingDate,
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
          // ─── Care-alert execution (Sage acting on bolting/pruning/harvest) ───
          case 'mark_pruned': {
            if (!action.cropId) break;
            // Find current pruning-cycle alert IDs for every active plant of
            // this crop and dismiss them. If the user pruned proactively
            // (before triggerDays), we still write the dismissal for cycle 0
            // so the day-N alert never fires.
            const ids = getDismissibleAlertIds(updatedPlants, action.cropId, 'pruning');
            persistCareDismissals(ids, userId);
            break;
          }
          case 'mark_bolting': {
            if (!action.cropId) break;
            // Set manualStatus = 'bolting' on the active plant. careAlerts.ts
            // already fires the critical "Bolting — harvest now" alert when
            // manualStatus is bolting, so this both records the state and
            // escalates the urgency if it wasn't already at the bolt window.
            const target = updatedPlants.find(p =>
              p.cropId === action.cropId && !p.removedDate && !p.harvestedDate,
            );
            if (target) {
              updatedPlants = updatedPlants.map(p =>
                p.id === target.id
                  ? { ...p, manualStatus: 'bolting' as PlantStatus }
                  : p,
              );
            }
            // Also dismiss any pre-existing bolt-risk alerts (the bolt
            // critical replaces them; user already knows).
            const ids = getDismissibleAlertIds(updatedPlants, action.cropId, 'bolting');
            persistCareDismissals(ids, userId);
            break;
          }
          case 'dismiss_care_alert': {
            if (!action.cropId || !action.alertType) break;
            // Map alertType → category for the dismissal helper
            let category: CareCategory | null = null;
            if (action.alertType === 'prune-now' || action.alertType === 'prune-overdue') {
              category = 'pruning';
            } else if (action.alertType === 'bolting' || action.alertType === 'bolt-risk') {
              category = 'bolting';
            } else if (action.alertType === 'harvest-ready' || action.alertType === 'harvest-urgent') {
              category = 'harvest';
            }
            if (!category) break;
            const ids = getDismissibleAlertIds(updatedPlants, action.cropId, category);
            persistCareDismissals(ids, userId);
            break;
          }
        }
      }

      return { plants: updatedPlants, beds: updatedBeds };
    });
  }, [updateState, userId]);

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
    reorderPlant,
    addBed,
    updateBed,
    deleteBed,
    applyActions,
  };
}
