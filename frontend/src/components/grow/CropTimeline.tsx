'use client';

import { useMemo } from 'react';
import { PlantingEvent, PlantingAction, formatAction } from '@/lib/plantingCalendar';

interface CropTimelineProps {
  events: PlantingEvent[];
  year: number;
  compact?: boolean;
}

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const actionColors: Record<PlantingAction, { bg: string; border: string; text: string }> = {
  'start-indoors': { bg: 'bg-purple-200', border: 'border-purple-400', text: 'text-purple-800' },
  'direct-sow': { bg: 'bg-green-200', border: 'border-green-400', text: 'text-green-800' },
  'transplant': { bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-800' },
  'harvest': { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-800' },
};

const actionIcons: Record<PlantingAction, string> = {
  'start-indoors': '🏠',
  'direct-sow': '🌱',
  'transplant': '🪴',
  'harvest': '🧺',
};

export function CropTimeline({ events, year, compact = false }: CropTimelineProps) {
  // Calculate position for each event (0-100% across the year)
  const timelineEvents = useMemo(() => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year, 11, 31).getTime();
    const totalDays = (yearEnd - yearStart) / (1000 * 60 * 60 * 24);

    return events.map(event => {
      const startOffset = (event.startDate.getTime() - yearStart) / (1000 * 60 * 60 * 24);
      const endOffset = (event.endDate.getTime() - yearStart) / (1000 * 60 * 60 * 24);

      return {
        ...event,
        startPercent: Math.max(0, Math.min(100, (startOffset / totalDays) * 100)),
        endPercent: Math.max(0, Math.min(100, (endOffset / totalDays) * 100)),
        widthPercent: Math.max(2, ((endOffset - startOffset) / totalDays) * 100), // Min 2% width
      };
    });
  }, [events, year]);

  if (compact) {
    return (
      <div className="space-y-1">
        {/* Month markers */}
        <div className="flex text-xs text-gray-400">
          {MONTH_ABBREV.map((month, i) => (
            <div key={month} className="flex-1 text-center">
              {i % 2 === 0 ? month[0] : ''}
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="relative h-6 bg-gray-100 rounded">
          {timelineEvents.map((event, i) => (
            <div
              key={`${event.action}-${i}`}
              className={`absolute h-full rounded ${actionColors[event.action].bg} border ${actionColors[event.action].border}`}
              style={{
                left: `${event.startPercent}%`,
                width: `${event.widthPercent}%`,
              }}
              title={`${formatAction(event.action)}: ${formatDateRange(event.startDate, event.endDate)}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full timeline view
  return (
    <div className="space-y-2">
      {/* Month labels */}
      <div className="flex text-xs text-gray-500 border-b pb-1">
        {MONTH_ABBREV.map(month => (
          <div key={month} className="flex-1 text-center font-medium">
            {month}
          </div>
        ))}
      </div>

      {/* Timeline rows - one per action type */}
      <div className="space-y-2">
        {(['start-indoors', 'direct-sow', 'transplant', 'harvest'] as PlantingAction[]).map(action => {
          const actionEvents = timelineEvents.filter(e => e.action === action);
          if (actionEvents.length === 0) return null;

          return (
            <div key={action} className="flex items-center gap-2">
              {/* Action label */}
              <div className="w-28 flex-shrink-0 flex items-center gap-1 text-sm">
                <span>{actionIcons[action]}</span>
                <span className={actionColors[action].text}>{formatAction(action)}</span>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-8 bg-gray-50 rounded border">
                {/* Month grid lines */}
                {MONTH_ABBREV.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${(i / 12) * 100}%` }}
                  />
                ))}

                {/* Event bars */}
                {actionEvents.map((event, i) => (
                  <div
                    key={i}
                    className={`absolute top-1 bottom-1 rounded ${actionColors[action].bg} border ${actionColors[action].border} flex items-center justify-center overflow-hidden`}
                    style={{
                      left: `${event.startPercent}%`,
                      width: `${Math.max(event.widthPercent, 3)}%`,
                    }}
                  >
                    <span className="text-xs px-1 truncate" title={event.notes}>
                      {formatDateRange(event.startDate, event.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend with details */}
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium mb-2">Schedule Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {events.map((event, i) => (
            <div
              key={`${event.action}-${i}`}
              className={`flex items-start gap-2 p-2 rounded ${actionColors[event.action].bg}`}
            >
              <span className="text-lg">{actionIcons[event.action]}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${actionColors[event.action].text}`}>
                  {formatAction(event.action)}
                </p>
                <p className="text-xs text-gray-600">
                  {formatDateRange(event.startDate, event.endDate)}
                </p>
                {event.notes && (
                  <p className="text-xs text-gray-500 mt-0.5">{event.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDateRange(start: Date, end: Date): string {
  const startMonth = MONTH_ABBREV[start.getMonth()];
  const endMonth = MONTH_ABBREV[end.getMonth()];
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    if (startDay === endDay) {
      return `${startMonth} ${startDay}`;
    }
    return `${startMonth} ${startDay}-${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}
