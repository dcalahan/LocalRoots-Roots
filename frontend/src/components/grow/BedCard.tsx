'use client';

import type { GardenBed, GardenPlant, BedType } from '@/types/my-garden';
import { GardenPlantCard } from './GardenPlantCard';

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
  firstFallFrost?: Date;
  onEdit: (bed: GardenBed) => void;
  onDelete: (bedId: string) => void;
  onAddPlant: (bedId: string) => void;
  onRemovePlant: (plantId: string) => void;
  onHarvestPlant: (plantId: string) => void;
  onUpdatePlant?: (plantId: string, updates: Partial<import('@/types/my-garden').GardenPlant>) => void;
}

export function BedCard({
  bed,
  plants,
  firstFallFrost,
  onEdit,
  onDelete,
  onAddPlant,
  onRemovePlant,
  onHarvestPlant,
  onUpdatePlant,
}: BedCardProps) {
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

        {plants.length === 0 ? (
          <div className="text-center py-6 text-sm text-roots-gray">
            No plants yet. Tap "+ Plant" to add some.
          </div>
        ) : (
          <div className="space-y-2">
            {plants.map(plant => (
              <GardenPlantCard
                key={plant.id}
                plant={plant}
                firstFallFrost={firstFallFrost}
                onRemove={onRemovePlant}
                onHarvest={onHarvestPlant}
                onUpdate={onUpdatePlant}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
