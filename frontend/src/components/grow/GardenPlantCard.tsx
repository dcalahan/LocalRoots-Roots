'use client';

import { useState, useRef } from 'react';
import type { GardenPlant, PlantingMethod } from '@/types/my-garden';
import { computeStatus, getEstimatedHarvestDate, getProgressPercent, getCropDisplayName } from '@/lib/gardenStatus';
import { PlantProgressBar } from './PlantProgressBar';

interface GardenPlantCardProps {
  plant: GardenPlant;
  firstFallFrost?: Date;
  onRemove?: (plantId: string) => void;
  onHarvest?: (plantId: string) => void;
  onUpdate?: (plantId: string, updates: Partial<GardenPlant>) => void;
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
  if (cropId.startsWith('tomato')) return '🍅';
  if (cropId.startsWith('pepper')) return '🌶️';
  if (cropId.startsWith('lettuce')) return '🥬';
  if (cropId === 'basil') return '🌿';
  if (cropId === 'cucumber' || cropId === 'cucumber-pickling') return '🥒';
  if (cropId === 'corn' || cropId === 'corn-sweet') return '🌽';
  if (cropId === 'strawberry') return '🍓';
  if (cropId === 'blueberry') return '🫐';
  if (cropId === 'carrot') return '🥕';

  try {
    const { getCropGrowingInfo } = require('@/lib/plantingCalendar');
    const info = getCropGrowingInfo(cropId);
    if (info?.category && categoryEmoji[info.category]) return categoryEmoji[info.category];
  } catch { /* */ }

  return '🌱';
}

export function GardenPlantCard({ plant, firstFallFrost, onRemove, onHarvest, onUpdate }: GardenPlantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(String(plant.quantity));
  const [editDate, setEditDate] = useState(plant.plantingDate);
  const [editMethod, setEditMethod] = useState<PlantingMethod>(plant.plantingMethod);
  const [editNotes, setEditNotes] = useState(plant.notes || '');
  const qtyRef = useRef<HTMLInputElement>(null);

  const status = computeStatus(plant, new Date(), firstFallFrost);
  const harvestDate = getEstimatedHarvestDate(plant);
  const progress = getProgressPercent(plant);
  const name = getCropDisplayName(plant.cropId, plant.customVarietyName);
  const parentName = plant.customVarietyName ? getCropDisplayName(plant.cropId) : null;
  const emoji = getCropEmoji(plant.cropId);

  const plantedDate = new Date(plant.plantingDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const harvestLabel = status === 'done'
    ? 'Completed'
    : `Harvest ~${harvestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const handleSave = () => {
    if (!onUpdate) return;
    const qty = parseInt(editQuantity, 10);
    onUpdate(plant.id, {
      quantity: qty > 0 ? qty : 1,
      plantingDate: editDate || plant.plantingDate,
      plantingMethod: editMethod,
      notes: editNotes.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditQuantity(String(plant.quantity));
    setEditDate(plant.plantingDate);
    setEditMethod(plant.plantingMethod);
    setEditNotes(plant.notes || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{name}</h4>
            <p className="text-xs text-roots-gray">
              {parentName && <span className="text-roots-secondary/70">({parentName}) · </span>}
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
          {onUpdate && status !== 'done' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs px-2 py-1 rounded-full text-roots-gray hover:bg-gray-100 transition-colors"
            >
              {isEditing ? 'Cancel' : '✏️'}
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

      {isEditing ? (
        <div className="space-y-2 mt-2 bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-roots-gray block mb-1">Quantity</label>
              <input
                ref={qtyRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editQuantity}
                onFocus={() => setTimeout(() => qtyRef.current?.select(), 0)}
                onChange={e => setEditQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center bg-white"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
            </div>
            <div>
              <label className="text-xs text-roots-gray block mb-1">Method</label>
              <select
                value={editMethod}
                onChange={e => setEditMethod(e.target.value as PlantingMethod)}
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
            <label className="text-xs text-roots-gray block mb-1">Planted on</label>
            <input
              type="date"
              value={editDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setEditDate(e.target.value)}
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>
          <div>
            <label className="text-xs text-roots-gray block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="e.g. South side of bed"
              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-roots-gray border border-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-roots-secondary"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
