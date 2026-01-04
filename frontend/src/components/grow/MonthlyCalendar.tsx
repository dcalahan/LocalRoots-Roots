'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useGrowingProfile } from '@/contexts/GrowingProfileContext';
import { getMonthlyCalendar, MonthlyCalendar as MonthlyCalendarType } from '@/lib/plantingCalendar';
import { PlantingCategoryList, PlantingCategorySummary } from './PlantingCategoryList';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthlyCalendarProps {
  initialMonth?: number;
  initialYear?: number;
  compact?: boolean;
}

export function MonthlyCalendar({
  initialMonth,
  initialYear,
  compact = false,
}: MonthlyCalendarProps) {
  const { profile, isLoading } = useGrowingProfile();
  const now = new Date();

  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());

  const calendar = useMemo<MonthlyCalendarType | null>(() => {
    if (!profile) return null;
    return getMonthlyCalendar(profile, month, year);
  }, [profile, month, year]);

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToCurrentMonth = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded w-1/2 mx-auto" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!profile || !calendar) {
    return (
      <div className="text-center py-8 text-roots-gray">
        <p>Unable to load planting calendar.</p>
        <p className="text-sm mt-2">Please set your growing zone first.</p>
      </div>
    );
  }

  const totalCrops =
    calendar.startIndoors.length +
    calendar.directSow.length +
    calendar.transplant.length +
    calendar.harvest.length;

  // Compact view for dashboard
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
            ← Prev
          </Button>
          <div className="text-center">
            <h3 className="font-heading font-bold">
              {MONTH_NAMES[month - 1]} {year}
            </h3>
            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="text-xs text-roots-primary hover:underline"
              >
                Go to today
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={goToNextMonth}>
            Next →
          </Button>
        </div>

        {/* Summary */}
        {totalCrops === 0 ? (
          <p className="text-sm text-roots-gray text-center py-4">
            No planting activities scheduled for this month.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {calendar.startIndoors.length > 0 && (
              <PlantingCategorySummary action="start-indoors" count={calendar.startIndoors.length} />
            )}
            {calendar.directSow.length > 0 && (
              <PlantingCategorySummary action="direct-sow" count={calendar.directSow.length} />
            )}
            {calendar.transplant.length > 0 && (
              <PlantingCategorySummary action="transplant" count={calendar.transplant.length} />
            )}
            {calendar.harvest.length > 0 && (
              <PlantingCategorySummary action="harvest" count={calendar.harvest.length} />
            )}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" onClick={goToPreviousMonth}>
          ← {MONTH_NAMES[(month - 2 + 12) % 12]}
        </Button>
        <div className="text-center min-w-[200px]">
          <h2 className="text-2xl font-heading font-bold">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="text-sm text-roots-primary hover:underline"
            >
              Go to current month
            </button>
          )}
        </div>
        <Button variant="outline" onClick={goToNextMonth}>
          {MONTH_NAMES[month % 12]} →
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <span className="text-sm text-roots-gray">This month:</span>
        {calendar.startIndoors.length > 0 && (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
            {calendar.startIndoors.length} start indoors
          </span>
        )}
        {calendar.directSow.length > 0 && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            {calendar.directSow.length} direct sow
          </span>
        )}
        {calendar.transplant.length > 0 && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            {calendar.transplant.length} transplant
          </span>
        )}
        {calendar.harvest.length > 0 && (
          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
            {calendar.harvest.length} harvest
          </span>
        )}
        {totalCrops === 0 && (
          <span className="text-sm text-roots-gray italic">No activities scheduled</span>
        )}
      </div>

      {/* Category lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlantingCategoryList
          title="Start Indoors"
          action="start-indoors"
          events={calendar.startIndoors}
          emptyMessage="No seeds to start indoors this month"
        />
        <PlantingCategoryList
          title="Direct Sow"
          action="direct-sow"
          events={calendar.directSow}
          emptyMessage="Nothing to direct sow this month"
        />
        <PlantingCategoryList
          title="Transplant Outdoors"
          action="transplant"
          events={calendar.transplant}
          emptyMessage="No transplanting this month"
        />
        <PlantingCategoryList
          title="Harvest"
          action="harvest"
          events={calendar.harvest}
          emptyMessage="Nothing ready to harvest this month"
        />
      </div>
    </div>
  );
}
