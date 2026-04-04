'use client';

import { useState, useMemo } from 'react';
import type { GardenPlant } from '@/types/my-garden';
import { groupPlantsByStatus, STATUS_CONFIG } from '@/lib/gardenStatus';
import { GardenPlantCard } from './GardenPlantCard';
import { AddPlantsModal } from './AddPlantsModal';
import type { PlantStatus } from '@/types/my-garden';

interface MyGardenViewProps {
  plants: GardenPlant[];
  onAddPlants: (plants: { cropId: string; quantity: number; plantingDate: string; plantingMethod: 'direct-sow' | 'transplant' | 'start-indoors'; location?: string; isPerennial: boolean }[]) => void;
  onRemove: (plantId: string) => void;
  onHarvest: (plantId: string) => void;
  zone?: string;
  locationName?: string;
  firstFallFrost?: Date;
}

// Display order for status groups
const STATUS_ORDER: PlantStatus[] = [
  'ready-to-harvest',
  'near-harvest',
  'harvesting',
  'growing',
  'seedling',
  'overwintering',
  'done',
];

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month < 2 || month === 11) return 'Winter';
  if (month < 5) return 'Spring';
  if (month < 8) return 'Summer';
  return 'Fall';
}

export function MyGardenView({
  plants,
  onAddPlants,
  onRemove,
  onHarvest,
  zone,
  locationName,
  firstFallFrost,
}: MyGardenViewProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Only show active plants (not removed/harvested)
  const activePlants = useMemo(
    () => plants.filter(p => !p.removedDate && !p.harvestedDate),
    [plants],
  );

  const groups = useMemo(
    () => groupPlantsByStatus(activePlants, new Date(), firstFallFrost),
    [activePlants, firstFallFrost],
  );

  const season = getCurrentSeason();
  const year = new Date().getFullYear();

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
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors text-sm"
        >
          + Add Plants
        </button>
      </div>

      {/* Empty state */}
      {activePlants.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-4">🌻</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to start growing?
          </h2>
          <p className="text-roots-gray mb-6 max-w-sm mx-auto">
            Track what you plant, watch it grow, and know exactly when it&apos;s time to harvest. You can also tell Sage what you planted and she&apos;ll add it here automatically!
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors"
          >
            I Just Planted My Garden!
          </button>
        </div>
      ) : (
        /* Status groups */
        <div className="space-y-6">
          {STATUS_ORDER.map(status => {
            const plantsInGroup = groups[status];
            if (plantsInGroup.length === 0) return null;

            const config = STATUS_CONFIG[status];

            return (
              <div key={status}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-roots-gray mb-3 flex items-center gap-2">
                  <span>{config.emoji}</span>
                  {config.label}
                  <span className="text-xs font-normal">({plantsInGroup.length})</span>
                </h3>
                <div className="space-y-3">
                  {plantsInGroup.map(plant => (
                    <GardenPlantCard
                      key={plant.id}
                      plant={plant}
                      firstFallFrost={firstFallFrost}
                      onRemove={onRemove}
                      onHarvest={onHarvest}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="text-center text-xs text-roots-gray pt-4 border-t">
            {activePlants.length} plant{activePlants.length !== 1 ? 's' : ''} in your garden
            {plants.filter(p => p.harvestedDate).length > 0 && (
              <> · {plants.filter(p => p.harvestedDate).length} harvested this season</>
            )}
          </div>
        </div>
      )}

      <AddPlantsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddPlants}
      />
    </>
  );
}
