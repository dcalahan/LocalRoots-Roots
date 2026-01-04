'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGrowingProfile } from '@/contexts/GrowingProfileContext';
import { getSeasonStatus } from '@/lib/growingZones';
import { ZoneSelector } from './ZoneSelector';
import { FrostDateEditor } from './FrostDateEditor';

interface GrowingProfileCardProps {
  compact?: boolean;
  showEdit?: boolean;
}

export function GrowingProfileCard({ compact = false, showEdit = true }: GrowingProfileCardProps) {
  const { profile, isLoading, hasManualOverride, formatFrostDate, getZoneDescription } = useGrowingProfile();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return (
      <Card className={compact ? '' : 'mb-6'}>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className={compact ? '' : 'mb-6'}>
        <CardContent className="py-6 text-center">
          <p className="text-roots-gray">Unable to determine your growing zone.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setIsEditing(true)}
          >
            Set Manually
          </Button>
        </CardContent>
      </Card>
    );
  }

  const seasonStatus = getSeasonStatus(profile);
  const seasonLabels = {
    'pre-season': { label: 'Pre-Season', color: 'bg-blue-100 text-blue-800' },
    'growing': { label: 'Growing Season', color: 'bg-green-100 text-green-800' },
    'post-season': { label: 'Post-Season', color: 'bg-amber-100 text-amber-800' },
    'year-round': { label: 'Year-Round Growing', color: 'bg-emerald-100 text-emerald-800' },
  };

  const currentSeason = seasonLabels[seasonStatus];

  if (isEditing) {
    return (
      <Card className={compact ? '' : 'mb-6'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-heading flex items-center justify-between">
            Edit Growing Profile
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ZoneSelector currentZone={profile.zone} onClose={() => setIsEditing(false)} />
          <FrostDateEditor
            lastSpringFrost={profile.lastSpringFrost}
            firstFallFrost={profile.firstFallFrost}
            onClose={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-roots-pale rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-roots-primary/10 rounded-full flex items-center justify-center text-lg">
            🌱
          </div>
          <div>
            <p className="font-medium text-sm">Zone {profile.zone}</p>
            <p className="text-xs text-roots-gray">
              {profile.isTropical ? 'Tropical' : `Frost-free: ${formatFrostDate(profile.lastSpringFrost)} - ${formatFrostDate(profile.firstFallFrost)}`}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentSeason.color}`}>
          {currentSeason.label}
        </span>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            Your Growing Profile
          </CardTitle>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentSeason.color}`}>
            {currentSeason.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Zone */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-roots-gray mb-1">Hardiness Zone</p>
            <p className="text-xl font-bold text-roots-primary">Zone {profile.zone}</p>
            <p className="text-xs text-roots-gray mt-1">
              {getZoneDescription(profile.zone).split(': ')[1]}
            </p>
          </div>

          {/* Frost Dates */}
          {!profile.isTropical ? (
            <>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-roots-gray mb-1">Last Spring Frost</p>
                <p className="text-lg font-semibold">{formatFrostDate(profile.lastSpringFrost)}</p>
                <p className="text-xs text-roots-gray mt-1">Safe to plant after this</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-roots-gray mb-1">First Fall Frost</p>
                <p className="text-lg font-semibold">{formatFrostDate(profile.firstFallFrost)}</p>
                <p className="text-xs text-roots-gray mt-1">
                  {profile.growingSeasonDays} day season
                </p>
              </div>
            </>
          ) : (
            <div className="p-3 bg-emerald-50 rounded-lg md:col-span-2">
              <p className="text-sm text-emerald-700 mb-1">Tropical Climate</p>
              <p className="text-lg font-semibold text-emerald-800">Year-round growing</p>
              <p className="text-xs text-emerald-600 mt-1">
                {profile.wetSeasonStart && profile.wetSeasonEnd
                  ? `Wet season: Month ${profile.wetSeasonStart} - ${profile.wetSeasonEnd}`
                  : 'No frost dates - grow any time'}
              </p>
            </div>
          )}
        </div>

        {/* Confidence indicator and edit */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-roots-gray">
            {profile.confidence === 'precise' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Precise (from your location)
              </span>
            )}
            {profile.confidence === 'estimated' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Estimated
              </span>
            )}
            {profile.confidence === 'manual' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Manually set
              </span>
            )}
            {hasManualOverride && profile.confidence !== 'manual' && (
              <span className="text-xs">(with overrides)</span>
            )}
          </div>

          {showEdit && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Adjust
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
