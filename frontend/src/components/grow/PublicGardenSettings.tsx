'use client';

import { useState } from 'react';
import { usePublicGardenProfile } from '@/hooks/usePublicGardenProfile';

interface Props {
  userId: string;
}

export function PublicGardenSettings({ userId }: Props) {
  const { profile, isPublic, isLoading, optIn, optOut, error } = usePublicGardenProfile(userId);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEnable = async () => {
    setLocalError(null);
    if (!displayName.trim()) {
      setLocalError('Please enter a display name.');
      return;
    }
    if (!navigator.geolocation) {
      setLocalError('Your browser does not support location. Try a different browser.');
      return;
    }
    setBusy(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 300000 });
      });
      await optIn({
        displayName,
        bio,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not enable sharing.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await optOut();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-roots-gray">Loading sharing settings…</div>;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Share my garden with neighbors</h3>
          <p className="text-xs text-roots-gray mt-1 max-w-md">
            Your beds and what you&apos;re growing show up on the public Gardeners directory.
            Your exact location is never shared — only your general area (~5km).
          </p>
        </div>
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
            isPublic ? 'bg-roots-secondary/10 text-roots-secondary' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      {isPublic && profile ? (
        <div className="space-y-3">
          <div className="text-sm">
            <div><span className="text-roots-gray">Display name:</span> {profile.displayName}</div>
            {profile.bio && <div className="text-roots-gray italic">&ldquo;{profile.bio}&rdquo;</div>}
            <div><span className="text-roots-gray">Area:</span> {profile.locationLabel}</div>
          </div>
          <button
            onClick={handleDisable}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-roots-primary border border-roots-primary/40 hover:bg-roots-primary/10 transition-colors disabled:opacity-50"
          >
            {busy ? 'Removing…' : 'Stop sharing'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Display name (e.g. Doug from Hilton Head)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            style={{ fontSize: 'max(16px, 0.875rem)' }}
          />
          <textarea
            placeholder="Short bio (optional) — what do you love growing?"
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={280}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none"
            style={{ fontSize: 'max(16px, 0.875rem)' }}
          />
          <button
            onClick={handleEnable}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Enabling…' : 'Share publicly'}
          </button>
          <p className="text-xs text-roots-gray">
            We&apos;ll ask for your location once to compute your general area. No exact coordinates are stored.
          </p>
        </div>
      )}

      {(localError || error) && (
        <p className="text-xs text-red-600 mt-2">{localError || error}</p>
      )}
    </div>
  );
}
