'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrowingProfileProvider } from '@/contexts/GrowingProfileContext';
import { GrowingProfileCard, MonthlyCalendar, GardenAIChat } from '@/components/grow';

function GrowPageContent() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Growing Guides</h1>
        <p className="text-roots-gray max-w-xl mx-auto">
          Know exactly when to plant based on your location. Get personalized
          planting schedules, frost dates, and growing tips.
        </p>
      </div>

      {/* Growing Profile */}
      <GrowingProfileCard />

      {/* What to Plant Now */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading">What to Plant Now</CardTitle>
            <Link href="/grow/calendar">
              <Button variant="outline" size="sm">
                Full Calendar →
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <MonthlyCalendar compact />
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/grow/calendar" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-heading font-semibold mb-1">Planting Calendar</h3>
              <p className="text-sm text-roots-gray">
                Month-by-month guide for your zone
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/grow/guides" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="font-heading font-semibold mb-1">Growing Guides</h3>
              <p className="text-sm text-roots-gray">
                Learn gardening techniques
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sell" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-roots-primary/30 bg-roots-pale">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl mb-3">💰</div>
              <h3 className="font-heading font-semibold mb-1 text-roots-primary">Start Selling</h3>
              <p className="text-sm text-roots-gray">
                Turn your harvest into income
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Popular Crops */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Popular Crops to Grow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'tomato-cherry', name: 'Cherry Tomatoes', emoji: '🍅' },
              { id: 'zucchini', name: 'Zucchini', emoji: '🥒' },
              { id: 'basil', name: 'Basil', emoji: '🌿' },
              { id: 'lettuce-romaine', name: 'Lettuce', emoji: '🥬' },
              { id: 'pepper-bell-green', name: 'Bell Peppers', emoji: '🫑' },
              { id: 'cucumber', name: 'Cucumbers', emoji: '🥒' },
              { id: 'green-beans', name: 'Green Beans', emoji: '🫛' },
              { id: 'carrot', name: 'Carrots', emoji: '🥕' },
            ].map(crop => (
              <Link
                key={crop.id}
                href={`/grow/crop/${crop.id}`}
                className="flex items-center gap-2 p-3 rounded-lg border hover:border-roots-primary hover:bg-roots-pale transition-colors"
              >
                <span className="text-2xl">{crop.emoji}</span>
                <span className="text-sm font-medium">{crop.name}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="mt-8 text-center p-6 bg-roots-pale rounded-xl">
        <h3 className="font-heading font-bold text-lg mb-2">
          Ready to grow and sell?
        </h3>
        <p className="text-roots-gray mb-4">
          LocalRoots connects backyard gardeners with neighbors who want fresh, local produce.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/sell">
            <Button className="bg-roots-primary">Start Selling</Button>
          </Link>
          <Link href="/buy">
            <Button variant="outline">Shop Local</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GrowPage() {
  return (
    <GrowingProfileProvider>
      <GrowPageContent />
      <GardenAIChat />
    </GrowingProfileProvider>
  );
}
