'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrowingProfileProvider, useGrowingProfile } from '@/contexts/GrowingProfileContext';
import { GrowingProfileCard, CropTimeline } from '@/components/grow';
import {
  getCropTimeline,
  getCropGrowingInfo,
  isValidCrop,
  getOptimalPlantingWindow,
  formatAction,
} from '@/lib/plantingCalendar';
import produceData from '../../../../../../data/produce-seeds.json';

function CropDetailContent() {
  const params = useParams();
  const cropId = params.id as string;
  const { profile, isLoading } = useGrowingProfile();

  // Get crop info
  const growingInfo = getCropGrowingInfo(cropId);
  const produceInfo = produceData.produce.find(p => p.id === cropId);

  // Calculate timeline
  const year = new Date().getFullYear();
  const timeline = useMemo(() => {
    if (!profile) return null;
    return getCropTimeline(cropId, profile, year);
  }, [cropId, profile, year]);

  const optimalWindow = useMemo(() => {
    if (!profile) return null;
    return getOptimalPlantingWindow(cropId, profile);
  }, [cropId, profile]);

  // Check if crop is valid
  if (!isValidCrop(cropId) || !growingInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/grow" className="text-sm text-roots-primary hover:underline">
            ← Back to Growing Guides
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🌱</div>
            <h2 className="text-xl font-heading font-bold mb-2">Crop Not Found</h2>
            <p className="text-roots-gray mb-4">
              We don&apos;t have growing information for this crop yet.
            </p>
            <Link href="/grow">
              <Button>Browse All Crops</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sunlightLabels: Record<string, string> = {
    full: 'Full Sun (6+ hours)',
    partial: 'Partial Sun (4-6 hours)',
    shade: 'Shade Tolerant',
  };

  const waterLabels: Record<string, string> = {
    low: 'Low - Drought tolerant',
    regular: 'Regular - Weekly watering',
    high: 'High - Keep consistently moist',
  };

  const frostLabels: Record<string, { label: string; color: string }> = {
    none: { label: 'Frost Sensitive', color: 'text-red-600' },
    light: { label: 'Light Frost Tolerant', color: 'text-yellow-600' },
    moderate: { label: 'Moderate Frost Tolerant', color: 'text-blue-600' },
    hardy: { label: 'Very Frost Hardy', color: 'text-green-600' },
  };

  // Type assertion for requirements
  const requirements = growingInfo.requirements as {
    sunlight: string;
    waterNeeds: string;
    spacingInches: number;
    soilPH: { min: number; max: number };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/grow" className="text-sm text-roots-primary hover:underline">
          ← Back to Growing Guides
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-32 h-32 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
          {produceInfo?.image ? (
            <img
              src={produceInfo.image}
              alt={growingInfo.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              🌱
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">{growingInfo.name}</h1>
          <p className="text-roots-gray mb-3">
            {growingInfo.category.charAt(0).toUpperCase() + growingInfo.category.slice(1)}
            {growingInfo.isPerennial && ' • Perennial'}
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {growingInfo.daysToMaturity.min}-{growingInfo.daysToMaturity.max} days to harvest
            </span>
            <span className={`px-3 py-1 rounded-full text-sm ${
              frostLabels[growingInfo.frostTolerance]?.color || 'text-gray-600'
            } bg-gray-100`}>
              {frostLabels[growingInfo.frostTolerance]?.label || growingInfo.frostTolerance}
            </span>
          </div>
        </div>
      </div>

      {/* Growing Profile */}
      <div className="mb-8">
        <GrowingProfileCard />
      </div>

      {/* Optimal Planting Window */}
      {optimalWindow && (
        <Card className="mb-6 border-roots-primary/30 bg-roots-pale">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {optimalWindow.action === 'start-indoors' ? '🏠' :
                 optimalWindow.action === 'direct-sow' ? '🌱' :
                 optimalWindow.action === 'transplant' ? '🪴' : '🧺'}
              </span>
              <div>
                <p className="text-sm text-roots-gray">Best time to {formatAction(optimalWindow.action).toLowerCase()}</p>
                <p className="font-heading font-bold text-roots-primary">
                  {formatDate(optimalWindow.start)} - {formatDate(optimalWindow.end)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {isLoading ? (
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/4" />
              <div className="h-40 bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
      ) : timeline && timeline.events.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-heading">{year} Growing Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.notSuitableReason ? (
              <p className="text-roots-gray py-4">{timeline.notSuitableReason}</p>
            ) : (
              <CropTimeline events={timeline.events} year={year} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <p className="text-roots-gray">
              Set your growing zone to see the planting timeline for your area.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Growing Requirements */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading">Growing Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-2xl">☀️</span>
              <p className="text-sm font-medium mt-1">
                {requirements.sunlight === 'full' ? 'Full Sun' :
                 requirements.sunlight === 'partial' ? 'Partial Sun' : 'Shade'}
              </p>
              <p className="text-xs text-roots-gray">
                {sunlightLabels[requirements.sunlight]?.split('(')[1]?.replace(')', '') || ''}
              </p>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">💧</span>
              <p className="text-sm font-medium mt-1">
                {requirements.waterNeeds === 'low' ? 'Low' :
                 requirements.waterNeeds === 'regular' ? 'Regular' : 'High'}
              </p>
              <p className="text-xs text-roots-gray">Water needs</p>
            </div>

            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <span className="text-2xl">↔️</span>
              <p className="text-sm font-medium mt-1">{requirements.spacingInches}&quot;</p>
              <p className="text-xs text-roots-gray">Spacing</p>
            </div>

            <div className="text-center p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">🧪</span>
              <p className="text-sm font-medium mt-1">
                {requirements.soilPH.min}-{requirements.soilPH.max}
              </p>
              <p className="text-xs text-roots-gray">Soil pH</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companion Planting */}
      {((growingInfo.companions as string[] | undefined)?.length ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-heading">Companion Planting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <span>✓</span> Plant With
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(growingInfo.companions as string[]).map((companion: string) => {
                    const companionInfo = getCropGrowingInfo(companion);
                    return (
                      <Link
                        key={companion}
                        href={`/grow/crop/${companion}`}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200 transition-colors"
                      >
                        {companionInfo?.name || companion}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {((growingInfo.avoid as string[] | undefined)?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                    <span>✗</span> Avoid Planting With
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(growingInfo.avoid as string[]).map((avoid: string) => {
                      const avoidInfo = getCropGrowingInfo(avoid);
                      return (
                        <Link
                          key={avoid}
                          href={`/grow/crop/${avoid}`}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200 transition-colors"
                        >
                          {avoidInfo?.name || avoid}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growing Tips */}
      {((growingInfo.tips as string[] | undefined)?.length ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-heading">Growing Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(growingInfo.tips as string[]).map((tip: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-roots-primary mt-0.5">•</span>
                  <span className="text-roots-gray">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sell This Crop */}
      <div className="p-6 bg-roots-pale rounded-xl text-center">
        <h3 className="font-heading font-bold text-lg mb-2">
          Ready to sell {growingInfo.name}?
        </h3>
        <p className="text-roots-gray mb-4">
          List your harvest on LocalRoots and connect with local buyers.
        </p>
        <Link href="/sell">
          <Button className="bg-roots-primary">Start Selling</Button>
        </Link>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CropDetailPage() {
  return (
    <GrowingProfileProvider>
      <CropDetailContent />
    </GrowingProfileProvider>
  );
}
