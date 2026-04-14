'use client';

import { useState, useMemo } from 'react';
import type { GardenPlant, GardenBed, PlantingMethod } from '@/types/my-garden';
import { GardenPlantCard } from './GardenPlantCard';
import { AddPlantsModal } from './AddPlantsModal';
import { BedCard } from './BedCard';
import { BedFormModal } from './BedFormModal';

interface MyGardenViewProps {
  plants: GardenPlant[];
  beds: GardenBed[];
  onAddPlants: (plants: { cropId: string; quantity: number; plantingDate: string; plantingMethod: PlantingMethod; location?: string; isPerennial: boolean; bedId?: string }[]) => void;
  onRemove: (plantId: string) => void;
  onHarvest: (plantId: string) => void;
  onUpdatePlant?: (plantId: string, updates: Partial<GardenPlant>) => void;
  onAddBed: (bed: Omit<GardenBed, 'id' | 'createdAt' | 'order'>) => void;
  onUpdateBed: (bedId: string, updates: Partial<GardenBed>) => void;
  onDeleteBed: (bedId: string) => void;
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
  zone,
  locationName,
  firstFallFrost,
}: MyGardenViewProps) {
  const [isAddPlantsModalOpen, setIsAddPlantsModalOpen] = useState(false);
  const [addPlantsBedId, setAddPlantsBedId] = useState<string | undefined>();
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<GardenBed | undefined>();

  const activePlants = useMemo(
    () => plants.filter(p => !p.removedDate && !p.harvestedDate),
    [plants],
  );

  const sortedBeds = useMemo(
    () => [...beds].sort((a, b) => a.order - b.order),
    [beds],
  );

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
    return { map, unassigned };
  }, [beds, activePlants]);

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
          {/* Bed cards */}
          {sortedBeds.map(bed => (
            <BedCard
              key={bed.id}
              bed={bed}
              plants={plantsByBed.map[bed.id] || []}
              firstFallFrost={firstFallFrost}
              onEdit={handleEditBed}
              onDelete={onDeleteBed}
              onAddPlant={handleAddPlantToBed}
              onRemovePlant={onRemove}
              onHarvestPlant={onHarvest}
              onUpdatePlant={onUpdatePlant}
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
