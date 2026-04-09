'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useGrowingProfileSafe } from '@/contexts/GrowingProfileContext';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useMyGarden } from '@/hooks/useMyGarden';
import { MyGardenView } from '@/components/grow/MyGardenView';
import { GardenAIChat } from '@/components/grow/GardenAIChat';
import { PublicGardenSettings } from '@/components/grow/PublicGardenSettings';

export default function MyGardenPage() {
  const { authenticated, login, user } = usePrivy();
  const growingProfileContext = useGrowingProfileSafe();
  const growingProfile = growingProfileContext?.profile;
  const { preferences } = useUserPreferences();

  // Use Privy user ID for storage
  const userId = user?.id || null;
  const {
    plants,
    beds,
    addPlants,
    removePlant,
    markHarvested,
    addBed,
    updateBed,
    deleteBed,
    isLoading,
  } = useMyGarden(userId);

  // Auth gate
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-4">🌱</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">My Garden</h1>
          <p className="text-roots-gray mb-6">
            Sign in to track your garden, monitor plant progress, and get personalized harvest reminders. No crypto wallet needed — just use your email, phone, or social login.
          </p>
          <button
            onClick={login}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors"
          >
            Sign In to Start Tracking
          </button>
          <p className="text-xs text-roots-gray mt-4">
            Works with email, phone, Google, Apple, or Instagram
          </p>
        </div>
        <GardenAIChat />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-64" />
            <div className="h-32 bg-gray-200 rounded-xl" />
            <div className="h-32 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <MyGardenView
          plants={plants}
          beds={beds}
          onAddPlants={addPlants}
          onRemove={removePlant}
          onHarvest={markHarvested}
          onAddBed={addBed}
          onUpdateBed={updateBed}
          onDeleteBed={deleteBed}
          zone={growingProfile?.zone}
          locationName={preferences.preferredLocation?.displayName}
          firstFallFrost={growingProfile?.firstFallFrost}
        />
        {userId && (
          <div className="mt-8">
            <PublicGardenSettings userId={userId} />
          </div>
        )}
      </div>
      <GardenAIChat />
    </div>
  );
}
