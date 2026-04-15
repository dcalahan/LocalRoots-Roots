'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrowingProfileProvider } from '@/contexts/GrowingProfileContext';
import { GrowingProfileCard, MonthlyCalendar, GardenAIChat } from '@/components/grow';
import { usePrivy } from '@privy-io/react-auth';
import { useMyGarden } from '@/hooks/useMyGarden';

function GrowPageContent() {
  const { user } = usePrivy();
  const userId = user?.id || null;
  const { activePlants, beds } = useMyGarden(userId);
  const hasGarden = activePlants.length > 0 || beds.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Your Garden</h1>
        <p className="text-roots-gray max-w-xl mx-auto">
          AI advice, planting calendar, and tracking — all personalized for your climate.
        </p>
      </div>

      {/* My Garden — prominent CTA when user has a garden */}
      {hasGarden && (
        <Link href="/grow/my-garden" className="block mb-6">
          <Card className="border-2 border-roots-primary bg-roots-primary/5 hover:bg-roots-primary/10 transition-colors cursor-pointer shadow-md">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-roots-primary flex items-center justify-center shadow-md">
                    <span className="text-2xl" style={{ filter: 'brightness(0) invert(1)' }}>🌱</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-bold text-lg text-gray-900">My Garden</h3>
                  <p className="text-sm text-roots-gray">
                    {activePlants.length} plant{activePlants.length !== 1 ? 's' : ''}
                    {beds.length > 0 ? ` across ${beds.length} bed${beds.length !== 1 ? 's' : ''}` : ''}
                    {' — '}tap to view
                  </p>
                </div>
                <div className="flex-shrink-0 text-roots-primary font-bold text-xl">→</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Ask the AI — prominent inline card */}
      <Card className="mb-6 border-roots-secondary/30 bg-gradient-to-r from-roots-secondary/5 to-roots-secondary/10">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-roots-secondary flex items-center justify-center shadow-md">
                <span className="text-2xl" style={{ filter: 'brightness(0) invert(1)' }}>🌱</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-heading font-semibold text-lg mb-1">Ask Sage anything about growing</h3>
              <p className="text-sm text-roots-gray">
                I know your local climate and can help with planting times, pest control, plant identification, garden planning — whatever you need.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button
                className="bg-roots-secondary hover:bg-roots-secondary/90"
                onClick={() => {
                  // Find and click the floating chat button
                  const chatBtn = document.querySelector('[data-garden-chat-toggle]') as HTMLButtonElement;
                  if (chatBtn) chatBtn.click();
                }}
              >
                Start a conversation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
      <div className={`grid grid-cols-1 ${hasGarden ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4 mb-8`}>
        {!hasGarden && (
          <Link href="/grow/my-garden" className="block">
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-roots-secondary/30 bg-roots-secondary/5">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🌱</div>
                <h3 className="font-heading font-semibold mb-1 text-roots-secondary">My Garden</h3>
                <p className="text-sm text-roots-gray">
                  Track what you planted
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/grow/calendar" className="block">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-heading font-semibold mb-1">Planting Calendar</h3>
              <p className="text-sm text-roots-gray">
                Month-by-month for your zone
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
                25+ technique guides
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
                className="flex items-center gap-2 p-3 rounded-lg border hover:border-roots-secondary hover:bg-roots-secondary/5 transition-colors"
              >
                <span className="text-2xl">{crop.emoji}</span>
                <span className="text-sm font-medium">{crop.name}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
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
