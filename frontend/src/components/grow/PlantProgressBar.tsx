'use client';

import type { PlantStatus } from '@/types/my-garden';

interface PlantProgressBarProps {
  percent: number;
  status: PlantStatus;
}

const statusColors: Record<PlantStatus, string> = {
  seedling: 'bg-roots-secondary',
  growing: 'bg-roots-secondary',
  'near-harvest': 'bg-roots-primary',
  'ready-to-harvest': 'bg-roots-primary',
  harvesting: 'bg-roots-primary',
  done: 'bg-roots-gray',
  overwintering: 'bg-roots-gray/50',
  'bolt-risk': 'bg-roots-primary',
  bolting: 'bg-roots-primary',
  'needs-pruning': 'bg-roots-secondary',
};

export function PlantProgressBar({ percent, status }: PlantProgressBarProps) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${statusColors[status]}`}
        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
      />
    </div>
  );
}
