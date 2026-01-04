'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrowingProfileProvider } from '@/contexts/GrowingProfileContext';
import { GrowingProfileCard, MonthlyCalendar, GardenAIChat } from '@/components/grow';

function CalendarPageContent() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/grow"
          className="text-sm text-roots-primary hover:underline"
        >
          ← Back to Growing Guides
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Planting Calendar</h1>
        <p className="text-roots-gray max-w-xl mx-auto">
          Your personalized month-by-month guide for what to plant based on your
          growing zone and frost dates.
        </p>
      </div>

      {/* Growing Profile Summary */}
      <div className="mb-8">
        <GrowingProfileCard />
      </div>

      {/* Full Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Monthly Planting Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyCalendar />
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Understanding the Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🏠</span>
              </div>
              <div>
                <h4 className="font-semibold text-purple-800">Start Indoors</h4>
                <p className="text-sm text-roots-gray">
                  Begin seeds indoors under lights or in a warm spot
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🌱</span>
              </div>
              <div>
                <h4 className="font-semibold text-green-800">Direct Sow</h4>
                <p className="text-sm text-roots-gray">
                  Plant seeds directly into garden soil
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🪴</span>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800">Transplant</h4>
                <p className="text-sm text-roots-gray">
                  Move seedlings outdoors after hardening off
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🧺</span>
              </div>
              <div>
                <h4 className="font-semibold text-orange-800">Harvest</h4>
                <p className="text-sm text-roots-gray">
                  Crops ready to pick and sell
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="mt-8 p-6 bg-roots-pale rounded-xl">
        <h3 className="font-heading font-bold text-lg mb-3">Planning Tips</h3>
        <ul className="space-y-2 text-sm text-roots-gray">
          <li className="flex items-start gap-2">
            <span className="text-roots-primary">•</span>
            <span>
              Check the weather forecast before planting outdoors. Late frosts can
              damage tender seedlings.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-roots-primary">•</span>
            <span>
              Succession planting (planting the same crop every 2-3 weeks) ensures
              continuous harvest for selling.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-roots-primary">•</span>
            <span>
              Cool-season crops (lettuce, spinach, peas) can be planted earlier and
              later in the season than warm-season crops.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-roots-primary">•</span>
            <span>
              Click on any crop to see detailed growing instructions and timing for
              your zone.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <GrowingProfileProvider>
      <CalendarPageContent />
      <GardenAIChat />
    </GrowingProfileProvider>
  );
}
