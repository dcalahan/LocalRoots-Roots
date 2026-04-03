'use client';

import type { GardenPlant, PlantStatus } from '@/types/my-garden';
import { computeStatus, getEstimatedHarvestDate, getProgressPercent, getCropDisplayName } from '@/lib/gardenStatus';
import { PlantProgressBar } from './PlantProgressBar';

interface GardenPlantCardProps {
  plant: GardenPlant;
  firstFallFrost?: Date;
  onRemove?: (plantId: string) => void;
  onHarvest?: (plantId: string) => void;
}

// Crop category → emoji mapping
const categoryEmoji: Record<string, string> = {
  nightshades: '🍅',
  cucurbits: '🥒',
  greens: '🥬',
  roots: '🥕',
  alliums: '🧅',
  legumes: '🫘',
  herbs: '🌿',
  brassicas: '🥦',
  berries: '🫐',
  'tree-fruit': '🍎',
  citrus: '🍋',
  grains: '🌽',
};

function getCropEmoji(cropId: string): string {
  // Special cases
  if (cropId.startsWith('tomato')) return '🍅';
  if (cropId.startsWith('pepper')) return '🌶️';
  if (cropId.startsWith('lettuce')) return '🥬';
  if (cropId === 'basil') return '🌿';
  if (cropId === 'cucumber' || cropId === 'cucumber-pickling') return '🥒';
  if (cropId === 'corn' || cropId === 'corn-sweet') return '🌽';
  if (cropId === 'strawberry') return '🍓';
  if (cropId === 'blueberry') return '🫐';
  if (cropId === 'carrot') return '🥕';

  // Try category
  try {
    const { getCropGrowingInfo } = require('@/lib/plantingCalendar');
    const info = getCropGrowingInfo(cropId);
    if (info?.category && categoryEmoji[info.category]) return categoryEmoji[info.category];
  } catch { /* */ }

  return '🌱';
}

export function GardenPlantCard({ plant, firstFallFrost, onRemove, onHarvest }: GardenPlantCardProps) {
  const status = computeStatus(plant, new Date(), firstFallFrost);
  const harvestDate = getEstimatedHarvestDate(plant);
  const progress = getProgressPercent(plant);
  const name = getCropDisplayName(plant.cropId);
  const emoji = getCropEmoji(plant.cropId);

  const plantedDate = new Date(plant.plantingDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const harvestLabel = status === 'done'
    ? 'Completed'
    : `Harvest ~${harvestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{name}</h4>
            <p className="text-xs text-roots-gray">
              {plant.quantity} plant{plant.quantity !== 1 ? 's' : ''}
              {plant.plantingMethod === 'start-indoors' ? ' · Started indoors' : ''}
              {plant.location ? ` · ${plant.location}` : ''}
            </p>
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-1">
          {(status === 'near-harvest' || status === 'ready-to-harvest' || status === 'harvesting') && onHarvest && (
            <button
              onClick={() => onHarvest(plant.id)}
              className="text-xs px-2 py-1 rounded-full bg-roots-primary/10 text-roots-primary hover:bg-roots-primary/20 transition-colors"
            >
              Harvested
            </button>
          )}
          {onRemove && status !== 'done' && (
            <button
              onClick={() => onRemove(plant.id)}
              className="text-xs px-2 py-1 rounded-full text-roots-gray hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mb-2">
        <PlantProgressBar percent={progress} status={status} />
      </div>

      <div className="flex justify-between text-xs text-roots-gray">
        <span>Planted {plantedDate}</span>
        <span>{harvestLabel}</span>
        <span>{progress}%</span>
      </div>

      {plant.notes && (
        <p className="mt-2 text-xs text-roots-gray italic">{plant.notes}</p>
      )}
    </div>
  );
}
