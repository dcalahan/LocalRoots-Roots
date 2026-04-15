'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { GardenPlant, GardenBed, PlantingMethod, PlantStatus } from '@/types/my-garden';
import { computeStatus, getCropDisplayName } from '@/lib/gardenStatus';
import { detectGardenAlerts, loadDismissals } from '@/lib/careAlerts';
import { GardenPlantCard } from './GardenPlantCard';
import { AddPlantsModal } from './AddPlantsModal';
import { BedCard } from './BedCard';
import { BedFormModal } from './BedFormModal';

interface MyGardenViewProps {
  plants: GardenPlant[];
  beds: GardenBed[];
  onAddPlants: (plants: { cropId: string; customVarietyName?: string; quantity: number; plantingDate: string; plantingMethod: PlantingMethod; location?: string; isPerennial: boolean; bedId?: string }[]) => void;
  onRemove: (plantId: string) => void;
  onHarvest: (plantId: string) => void;
  onUpdatePlant?: (plantId: string, updates: Partial<GardenPlant>) => void;
  onAddBed: (bed: Omit<GardenBed, 'id' | 'createdAt' | 'order'>) => void;
  onUpdateBed: (bedId: string, updates: Partial<GardenBed>) => void;
  onDeleteBed: (bedId: string) => void;
  onReorderPlant?: (plantId: string, direction: 'up' | 'down') => void;
  userId?: string;
  zone?: string;
  locationName?: string;
  firstFallFrost?: Date;
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month < 2 || month === 11) return 'Winter';
  if (month < 5) return 'Spring';
  if (month < 8) return 'Summer';
  return 'Fall';
}

export function MyGardenView({
  plants,
  beds,
  onAddPlants,
  onRemove,
  onHarvest,
  onUpdatePlant,
  onAddBed,
  onUpdateBed,
  onDeleteBed,
  onReorderPlant,
  userId,
  zone,
  locationName,
  firstFallFrost,
}: MyGardenViewProps) {
  const [isAddPlantsModalOpen, setIsAddPlantsModalOpen] = useState(false);
  const [addPlantsBedId, setAddPlantsBedId] = useState<string | undefined>();
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<GardenBed | undefined>();
  const [isReordering, setIsReordering] = useState(false);
  const [dismissals, setDismissals] = useState<Record<string, string>>({});
  const router = useRouter();
  useEffect(() => { setDismissals(loadDismissals()); }, []);

  // Listen for "list for sale" events from plant cards
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { cropId: string; quantity: number };
      const params = new URLSearchParams({
        crop: detail.cropId,
        qty: String(detail.quantity),
        source: 'garden',
      });
      router.push(`/sell/create?${params.toString()}`);
    };
    window.addEventListener('garden:list-for-sale', handler);
    return () => window.removeEventListener('garden:list-for-sale', handler);
  }, [router]);

  const activePlants = useMemo(
    () => plants.filter(p => !p.removedDate && !p.harvestedDate),
    [plants],
  );

  const sortedBeds = useMemo(
    () => [...beds].sort((a, b) => a.order - b.order),
    [beds],
  );

  const STATUS_PRIORITY: Record<PlantStatus, number> = {
    'ready-to-harvest': 0, 'harvesting': 1, 'near-harvest': 2,
    'growing': 3, 'seedling': 4, 'overwintering': 5, 'done': 6,
    'bolting': 0, 'bolt-risk': 1, 'needs-pruning': 2,
  };

  const plantsByBed = useMemo(() => {
    const map: Record<string, GardenPlant[]> = {};
    for (const bed of beds) map[bed.id] = [];
    const unassigned: GardenPlant[] = [];
    for (const p of activePlants) {
      if (p.bedId && map[p.bedId]) {
        map[p.bedId].push(p);
      } else {
        unassigned.push(p);
      }
    }
    // Sort unassigned by status priority
    unassigned.sort((a, b) => {
      const sa = computeStatus(a, new Date(), firstFallFrost);
      const sb = computeStatus(b, new Date(), firstFallFrost);
      return (STATUS_PRIORITY[sa] ?? 6) - (STATUS_PRIORITY[sb] ?? 6);
    });
    return { map, unassigned };
  }, [beds, activePlants, firstFallFrost]);

  // Garden-wide alerts for summary card (only urgent/critical surface here)
  const urgentAlerts = useMemo(() => {
    const all = detectGardenAlerts(activePlants, new Date(), { dismissals });
    return all.filter(a => a.severity === 'urgent' || a.severity === 'critical');
  }, [activePlants, dismissals]);

  const season = getCurrentSeason();
  const year = new Date().getFullYear();

  const handleAddPlantToBed = (bedId: string) => {
    setAddPlantsBedId(bedId);
    setIsAddPlantsModalOpen(true);
  };

  const handleAddPlantsGeneric = () => {
    setAddPlantsBedId(undefined);
    setIsAddPlantsModalOpen(true);
  };

  const handleEditBed = (bed: GardenBed) => {
    setEditingBed(bed);
    setIsBedModalOpen(true);
  };

  const handleNewBed = () => {
    setEditingBed(undefined);
    setIsBedModalOpen(true);
  };

  const handleSaveBed = (bed: Omit<GardenBed, 'id' | 'createdAt' | 'order'>) => {
    if (editingBed) {
      onUpdateBed(editingBed.id, bed);
    } else {
      onAddBed(bed);
    }
    setEditingBed(undefined);
  };

  const targetBedName = addPlantsBedId
    ? beds.find(b => b.id === addPlantsBedId)?.name
    : undefined;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🌱</span> My Garden
          </h1>
          <p className="text-sm text-roots-gray mt-1">
            {season} {year}
            {zone && ` · Zone ${zone}`}
            {locationName && ` · ${locationName}`}
          </p>
        </div>
        <div className="flex gap-2">
          {activePlants.length > 1 && onReorderPlant && (
            <button
              onClick={() => setIsReordering(!isReordering)}
              className={`px-3 py-2 rounded-xl font-semibold text-sm transition-colors ${
                isReordering
                  ? 'bg-roots-primary/10 text-roots-primary border border-roots-primary/30'
                  : 'text-roots-gray border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isReordering ? 'Done' : '↕'}
            </button>
          )}
          <button
            onClick={handleNewBed}
            className="px-3 py-2 rounded-xl font-semibold text-roots-secondary border border-roots-secondary/30 hover:bg-roots-secondary/10 transition-colors text-sm"
          >
            + Bed
          </button>
          <button
            onClick={handleAddPlantsGeneric}
            className="px-4 py-2 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors text-sm"
          >
            + Plants
          </button>
        </div>
      </div>

      {/* Empty state */}
      {activePlants.length === 0 && beds.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-4">🌻</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to start growing?
          </h2>
          <p className="text-roots-gray mb-6 max-w-sm mx-auto">
            Document your beds with photos, track what you plant, and watch it grow. You can also tell Sage what you planted and it&apos;ll add it here automatically!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleNewBed}
              className="px-6 py-3 rounded-xl font-semibold text-roots-secondary border-2 border-roots-secondary hover:bg-roots-secondary/10 transition-colors"
            >
              Add Your First Bed
            </button>
            <button
              onClick={handleAddPlantsGeneric}
              className="px-6 py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors"
            >
              Just Add Plants
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Attention needed summary */}
          {urgentAlerts.length > 0 && (
            <div className="bg-roots-primary/10 border border-roots-primary/30 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none mt-0.5">⚠️</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-roots-primary">
                    {urgentAlerts.length} plant{urgentAlerts.length !== 1 ? 's' : ''} need{urgentAlerts.length === 1 ? 's' : ''} attention
                  </h2>
                  <ul className="text-sm text-roots-gray mt-1 space-y-0.5">
                    {urgentAlerts.slice(0, 5).map(a => {
                      const p = activePlants.find(pp => pp.id === a.plantId);
                      const name = p ? getCropDisplayName(p.cropId, p.customVarietyName) : a.cropId;
                      return (
                        <li key={a.id}>
                          <span className="font-medium text-gray-900">{name}</span>
                          <span className="text-roots-gray"> — {a.title.toLowerCase()}</span>
                        </li>
                      );
                    })}
                    {urgentAlerts.length > 5 && (
                      <li className="italic">+ {urgentAlerts.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Bed cards */}
          {sortedBeds.map(bed => (
            <BedCard
              key={bed.id}
              bed={bed}
              plants={plantsByBed.map[bed.id] || []}
              allBeds={beds}
              firstFallFrost={firstFallFrost}
              onEdit={handleEditBed}
              onDelete={onDeleteBed}
              onAddPlant={handleAddPlantToBed}
              onRemovePlant={onRemove}
              onHarvestPlant={onHarvest}
              onUpdatePlant={onUpdatePlant}
              onReorderPlant={onReorderPlant}
              isReordering={isReordering}
            />
          ))}

          {/* Unassigned plants */}
          {plantsByBed.unassigned.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-roots-gray mb-3">
                Unassigned Plants ({plantsByBed.unassigned.length})
              </h3>
              <div className="space-y-2">
                {plantsByBed.unassigned.map(plant => (
                  <GardenPlantCard
                    key={plant.id}
                    plant={plant}
                    beds={beds}
                    firstFallFrost={firstFallFrost}
                    onRemove={onRemove}
                    onHarvest={onHarvest}
                    onUpdate={onUpdatePlant}
                  />
                ))}
              </div>
              {beds.length > 0 && (
                <p className="text-xs text-roots-gray italic mt-2">
                  Tip: Edit a plant or ask Sage to assign these to a bed.
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="text-center text-xs text-roots-gray pt-4 border-t">
            {activePlants.length} plant{activePlants.length !== 1 ? 's' : ''}
            {beds.length > 0 && ` across ${beds.length} bed${beds.length !== 1 ? 's' : ''}`}
            {plants.filter(p => p.harvestedDate).length > 0 && (
              <> · {plants.filter(p => p.harvestedDate).length} harvested this season</>
            )}
          </div>
        </div>
      )}

      <AddPlantsModal
        isOpen={isAddPlantsModalOpen}
        onClose={() => {
          setIsAddPlantsModalOpen(false);
          setAddPlantsBedId(undefined);
        }}
        onAdd={onAddPlants}
        defaultBedId={addPlantsBedId}
        bedName={targetBedName}
        userId={userId}
        beds={beds}
      />

      <BedFormModal
        isOpen={isBedModalOpen}
        onClose={() => {
          setIsBedModalOpen(false);
          setEditingBed(undefined);
        }}
        onSave={handleSaveBed}
        initialBed={editingBed}
      />
    </>
  );
}
