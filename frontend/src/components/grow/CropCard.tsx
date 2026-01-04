'use client';

import Link from 'next/link';
import { PlantingAction, formatAction, getActionColor } from '@/lib/plantingCalendar';

interface CropCardProps {
  cropId: string;
  cropName: string;
  actions?: PlantingAction[];
  notes?: string;
  imageUrl?: string;
  compact?: boolean;
}

// Action badges with colors
function ActionBadge({ action }: { action: PlantingAction }) {
  const colorMap: Record<PlantingAction, string> = {
    'start-indoors': 'bg-purple-100 text-purple-800',
    'direct-sow': 'bg-green-100 text-green-800',
    'transplant': 'bg-blue-100 text-blue-800',
    'harvest': 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[action]}`}>
      {formatAction(action)}
    </span>
  );
}

// Action icons
function ActionIcon({ action }: { action: PlantingAction }) {
  const icons: Record<PlantingAction, string> = {
    'start-indoors': '🏠',
    'direct-sow': '🌱',
    'transplant': '🪴',
    'harvest': '🧺',
  };
  return <span>{icons[action]}</span>;
}

export function CropCard({ cropId, cropName, actions, notes, imageUrl, compact = false }: CropCardProps) {
  if (compact) {
    return (
      <Link
        href={`/grow/crop/${cropId}`}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={cropName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🌱</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{cropName}</p>
          {actions && actions.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-0.5">
              {actions.map(action => (
                <span key={action} className="text-xs text-roots-gray">
                  <ActionIcon action={action} /> {formatAction(action)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/grow/crop/${cropId}`}
      className="block p-4 rounded-lg border border-gray-200 hover:border-roots-primary hover:shadow-sm transition-all"
    >
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={cropName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🌱</div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{cropName}</h3>
          {actions && actions.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {actions.map(action => (
                <ActionBadge key={action} action={action} />
              ))}
            </div>
          )}
          {notes && (
            <p className="text-xs text-roots-gray mt-1 line-clamp-2">{notes}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
