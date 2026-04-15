'use client';

import { useMemo } from 'react';
import type { GardenBed, GardenPlant, BedType, PlantStatus } from '@/types/my-garden';
import { computeStatus } from '@/lib/gardenStatus';
import { GardenPlantCard } from './GardenPlantCard';

// Status priority: needs-attention first, then growing, then done
const STATUS_PRIORITY: Record<PlantStatus, number> = {
  'ready-to-harvest': 0,
  'harvesting': 1,
  'near-harvest': 2,
  'growing': 3,
  'seedling': 4,
  'overwintering': 5,
  'done': 6,
  'bolting': 0,
  'bolt-risk': 1,
  'needs-pruning': 2,
};

const BED_TYPE_LABELS: Record<BedType, string> = {
  'raised-bed': 'Raised bed',
  'in-ground': 'In-ground',
  'tower': 'Tower',
  'container': 'Container',
  'greenhouse': 'Greenhouse',
  'other': 'Other',
};

const BED_TYPE_EMOJI: Record<BedType, string> = {
  'raised-bed': '🟫',
  'in-ground': '🌍',
  'tower': '🗼',
  'container': '🪴',
  'greenhouse': '🏠',
  'other': '🌱',
};

interface BedCardProps {
  bed: GardenBed;
  plants: GardenPlant[];
  /** All beds, used for moving a plant between beds in edit mode. */
  allBeds?: GardenBed[];
  firstFallFrost?: Date;
  onEdit: (bed: GardenBed) => void;
  onDelete: (bedId: string) => void;
  onAddPlant: (bedId: string) => void;
  onRemovePlant: (plantId: string) => void;
  onHarvestPlant: (plantId: string) => void;
  onUpdatePlant?: (plantId: string, updates: Partial<import('@/types/my-garden').GardenPlant>) => void;
  onReorderPlant?: (plantId: string, direction: 'up' | 'down') => void;
  isReordering?: boolean;
}

export function BedCard({
  bed,
  plants,
  allBeds,
  firstFallFrost,
  onEdit,
  onDelete,
  onAddPlant,
  onRemovePlant,
  onHarvestPlant,
  onUpdatePlant,
  onReorderPlant,
  isReordering,
}: BedCardProps) {
  // Sort: if plants have orderInBed set, use that; otherwise sort by status priority
  const sortedPlants = useMemo(() => {
    const hasOrder = plants.some(p => p.orderInBed !== undefined);
    if (hasOrder) {
      return [...plants].sort((a, b) => (a.orderInBed ?? 999) - (b.orderInBed ?? 999));
    }
    return [...plants].sort((a, b) => {
      const sa = computeStatus(a, new Date(), firstFallFrost);
      const sb = computeStatus(b, new Date(), firstFallFrost);
      return (STATUS_PRIORITY[sa] ?? 6) - (STATUS_PRIORITY[sb] ?? 6);
    });
  }, [plants, firstFallFrost]);

  const dimensions = bed.widthInches && bed.lengthInches
    ? `${bed.widthInches}" × ${bed.lengthInches}"`
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Photo header */}
      <div className="relative h-40 bg-gradient-to-br from-roots-secondary/20 to-roots-primary/20">
        {bed.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bed.photoUrl}
            alt={bed.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-60">
            {BED_TYPE_EMOJI[bed.type]}
          </div>
        )}
        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => onEdit(bed)}
            className="text-xs px-2 py-1 rounded-full bg-white/90 text-roots-gray hover:bg-white transition-colors backdrop-blur-sm"
            aria-label="Edit bed"
          >
            ✏️
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${bed.name}"? Plants in this bed will become unassigned.`)) {
                onDelete(bed.id);
              }
            }}
            className="text-xs px-2 py-1 rounded-full bg-white/90 text-roots-gray hover:bg-white transition-colors backdrop-blur-sm"
            aria-label="Delete bed"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Bed info */}
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span>{BED_TYPE_EMOJI[bed.type]}</span>
              {bed.name}
            </h3>
            <p className="text-xs text-roots-gray">
              {BED_TYPE_LABELS[bed.type]}
              {dimensions && ` · ${dimensions}`}
              {' · '}
              {plants.length} plant{plants.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => onAddPlant(bed.id)}
            className="text-xs px-3 py-1.5 rounded-full bg-roots-secondary/10 text-roots-secondary hover:bg-roots-secondary/20 transition-colors font-semibold"
          >
            + Plant
          </button>
        </div>

        {bed.notes && (
          <p className="text-xs text-roots-gray italic mb-3">{bed.notes}</p>
        )}

        {sortedPlants.length === 0 ? (
          <div className="text-center py-6 text-sm text-roots-gray">
            No plants yet. Tap &ldquo;+ Plant&rdquo; to add some.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPlants.map((plant, idx) => (
              <div key={plant.id} className="flex items-stretch gap-1">
                {isReordering && onReorderPlant && (
                  <div className="flex flex-col justify-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onReorderPlant(plant.id, 'up')}
                      disabled={idx === 0}
                      className="px-1.5 py-1 text-xs text-roots-gray hover:text-roots-secondary disabled:opacity-20 touch-manipulation"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => onReorderPlant(plant.id, 'down')}
                      disabled={idx === sortedPlants.length - 1}
                      className="px-1.5 py-1 text-xs text-roots-gray hover:text-roots-secondary disabled:opacity-20 touch-manipulation"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <GardenPlantCard
                    plant={plant}
                    beds={allBeds}
                    firstFallFrost={firstFallFrost}
                    onRemove={onRemovePlant}
                    onHarvest={onHarvestPlant}
                    onUpdate={onUpdatePlant}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
