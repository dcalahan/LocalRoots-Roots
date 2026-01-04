'use client';

import { PlantingEvent, PlantingAction, formatAction } from '@/lib/plantingCalendar';
import { CropCard } from './CropCard';
import produceData from '../../../../data/produce-seeds.json';

interface PlantingCategoryListProps {
  title: string;
  action: PlantingAction;
  events: PlantingEvent[];
  emptyMessage?: string;
}

// Get image URL for a crop
function getCropImage(cropId: string): string | undefined {
  const produce = produceData.produce.find(p => p.id === cropId);
  return produce?.image;
}

// Category icons
const categoryIcons: Record<PlantingAction, string> = {
  'start-indoors': '🏠',
  'direct-sow': '🌱',
  'transplant': '🪴',
  'harvest': '🧺',
};

// Category colors
const categoryColors: Record<PlantingAction, { bg: string; border: string; text: string }> = {
  'start-indoors': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  'direct-sow': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  'transplant': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  'harvest': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
};

export function PlantingCategoryList({
  title,
  action,
  events,
  emptyMessage = 'Nothing scheduled for this category',
}: PlantingCategoryListProps) {
  const colors = categoryColors[action];
  const icon = categoryIcons[action];

  // Dedupe events by cropId (a crop might have multiple events in same category)
  const uniqueCrops = new Map<string, PlantingEvent>();
  events.forEach(event => {
    if (!uniqueCrops.has(event.cropId)) {
      uniqueCrops.set(event.cropId, event);
    }
  });

  const cropList = Array.from(uniqueCrops.values());

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className={`font-heading font-semibold ${colors.text}`}>
          {title}
        </h3>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${colors.text} bg-white/50`}>
          {cropList.length} {cropList.length === 1 ? 'crop' : 'crops'}
        </span>
      </div>

      {cropList.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {cropList.map(event => (
            <CropCard
              key={event.cropId}
              cropId={event.cropId}
              cropName={event.cropName}
              notes={event.notes}
              imageUrl={getCropImage(event.cropId)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact version for dashboard
export function PlantingCategorySummary({
  action,
  count,
}: {
  action: PlantingAction;
  count: number;
}) {
  const colors = categoryColors[action];
  const icon = categoryIcons[action];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bg}`}>
      <span>{icon}</span>
      <span className={`text-sm font-medium ${colors.text}`}>
        {count} to {formatAction(action).toLowerCase()}
      </span>
    </div>
  );
}
