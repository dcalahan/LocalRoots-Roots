'use client';

import { useState, useRef } from 'react';
import { usePublicGardenProfile } from '@/hooks/usePublicGardenProfile';
// Dynamic import to avoid Pinata SDK initialization issues on some browsers
async function doUpload(file: File) {
  const { uploadImage } = await import('@/lib/pinata');
  return uploadImage(file);
}
import Image from 'next/image';

interface Props {
  userId: string;
}

function PhotoUpload({
  label,
  photoUrl,
  onUpload,
  circular,
}: {
  label: string;
  photoUrl?: string;
  onUpload: (url: string, ipfs: string) => void;
  circular?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Photo must be under 8 MB.');
      return;
    }
    setUploading(true);
    try {
      const result = await doUpload(file);
      onUpload(result.url, result.ipfsHash);
    } catch {
      alert('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed border-gray-300 hover:border-roots-secondary/50 transition-colors flex items-center justify-center overflow-hidden ${
          circular ? 'w-16 h-16 rounded-full' : 'w-full h-32 rounded-xl'
        } ${uploading ? 'opacity-50' : ''}`}
      >
        {uploading ? (
          <span className="text-xs text-roots-gray">Uploading…</span>
        ) : photoUrl ? (
          <Image
            src={photoUrl}
            alt={label}
            width={circular ? 64 : 400}
            height={circular ? 64 : 128}
            className={`object-cover ${circular ? 'w-16 h-16' : 'w-full h-32'}`}
          />
        ) : (
          <span className="text-xs text-roots-gray">Tap to add</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

export function PublicGardenSettings({ userId }: Props) {
  const { profile, isPublic, isLoading, optIn, optOut, error } = usePublicGardenProfile(userId);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>();
  const [profilePhotoIpfs, setProfilePhotoIpfs] = useState<string | undefined>();
  const [gardenPhotoUrl, setGardenPhotoUrl] = useState<string | undefined>();
  const [gardenPhotoIpfs, setGardenPhotoIpfs] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Edit mode — pre-fill from existing profile
  const [editing, setEditing] = useState(false);
  const startEditing = () => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio || '');
      setProfilePhotoUrl(profile.profilePhotoUrl);
      setProfilePhotoIpfs(profile.profilePhotoIpfs);
      setGardenPhotoUrl(profile.gardenPhotoUrl);
      setGardenPhotoIpfs(profile.gardenPhotoIpfs);
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setLocalError(null);
    if (!displayName.trim()) {
      setLocalError('Please enter a display name.');
      return;
    }
    setBusy(true);
    try {
      // Try to get location, but don't block save if denied
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 300000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          // User denied or timed out — save without location
        }
      }

      await optIn({
        displayName,
        bio,
        latitude,
        longitude,
        profilePhotoUrl,
        profilePhotoIpfs,
        gardenPhotoUrl,
        gardenPhotoIpfs,
      });
      setEditing(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await optOut();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-roots-gray">Loading sharing settings…</div>;
  }

  // Show form when not public, or when editing
  const showForm = !isPublic || editing;

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

      {isPublic && !editing && profile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {profile.profilePhotoUrl && (
              <Image
                src={profile.profilePhotoUrl}
                alt={profile.displayName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="text-sm">
              <div className="font-medium">{profile.displayName}</div>
              {profile.bio && <div className="text-roots-gray italic">&ldquo;{profile.bio}&rdquo;</div>}
              <div className="text-roots-gray">{profile.locationLabel}</div>
            </div>
          </div>
          {profile.gardenPhotoUrl && (
            <Image
              src={profile.gardenPhotoUrl}
              alt="My garden"
              width={400}
              height={128}
              className="w-full h-32 object-cover rounded-xl"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={startEditing}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-roots-secondary border border-roots-secondary/40 hover:bg-roots-secondary/10 transition-colors"
            >
              Edit profile
            </button>
            <button
              onClick={handleDisable}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-roots-primary border border-roots-primary/40 hover:bg-roots-primary/10 transition-colors disabled:opacity-50"
            >
              {busy ? 'Removing…' : 'Stop sharing'}
            </button>
          </div>
        </div>
      ) : showForm ? (
        <div className="space-y-3">
          <div className="flex gap-4 items-start">
            <PhotoUpload
              label="Your photo"
              photoUrl={profilePhotoUrl}
              circular
              onUpload={(url, ipfs) => { setProfilePhotoUrl(url); setProfilePhotoIpfs(ipfs); }}
            />
            <div className="flex-1 space-y-3">
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
            </div>
          </div>
          <PhotoUpload
            label="Garden photo"
            photoUrl={gardenPhotoUrl}
            onUpload={(url, ipfs) => { setGardenPhotoUrl(url); setGardenPhotoIpfs(ipfs); }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-roots-secondary hover:bg-roots-secondary/90 transition-colors disabled:opacity-50"
            >
              {busy ? 'Saving…' : isPublic ? 'Save changes' : 'Share publicly'}
            </button>
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-roots-gray">
            We&apos;ll ask for your location to show your general area. You can still save without sharing location.
          </p>
        </div>
      ) : null}

      {(localError || error) && (
        <p className="text-xs text-red-600 mt-2">{localError || error}</p>
      )}
    </div>
  );
}
