'use client';

import { useState, useEffect } from 'react';
import type { GardenBed, BedType } from '@/types/my-garden';
import { uploadImage } from '@/lib/pinata';

interface BedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bed: Omit<GardenBed, 'id' | 'createdAt' | 'order'>) => void;
  initialBed?: GardenBed;
}

const BED_TYPES: { value: BedType; label: string }[] = [
  { value: 'raised-bed', label: 'Raised bed' },
  { value: 'in-ground', label: 'In-ground' },
  { value: 'tower', label: 'Tower' },
  { value: 'container', label: 'Container' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'other', label: 'Other' },
];

export function BedFormModal({ isOpen, onClose, onSave, initialBed }: BedFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<BedType>('raised-bed');
  const [width, setWidth] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoIpfs, setPhotoIpfs] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialBed?.name || '');
      setType(initialBed?.type || 'raised-bed');
      setWidth(initialBed?.widthInches?.toString() || '');
      setLength(initialBed?.lengthInches?.toString() || '');
      setNotes(initialBed?.notes || '');
      setPhotoUrl(initialBed?.photoUrl);
      setPhotoIpfs(initialBed?.photoIpfs);
      setUploadError(null);
    }
  }, [isOpen, initialBed]);

  if (!isOpen) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image must be under 8 MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      setPhotoUrl(result.url);
      setPhotoIpfs(result.ipfsHash);
    } catch (err) {
      console.error('[BedFormModal] Upload failed:', err);
      setUploadError('Upload failed. Try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      widthInches: width ? parseInt(width) : undefined,
      lengthInches: length ? parseInt(length) : undefined,
      notes: notes.trim() || undefined,
      photoUrl,
      photoIpfs,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {initialBed ? 'Edit bed' : 'Add a bed'}
          </h2>
          <button
            onClick={onClose}
            className="text-roots-gray hover:text-gray-900 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Photo */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Photo (optional)
            </label>
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Bed preview"
                className="w-full h-40 object-cover rounded-xl mb-2"
              />
            )}
            <label className="block w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-center text-sm text-roots-gray cursor-pointer hover:border-roots-secondary hover:text-roots-secondary transition-colors">
              {isUploading ? 'Uploading…' : photoUrl ? 'Change photo' : '📷 Add a photo of this bed'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bed 1, Tower, Front yard"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-roots-secondary focus:outline-none"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as BedType)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-roots-secondary focus:outline-none bg-white"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            >
              {BED_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Width (in)
              </label>
              <input
                type="number"
                value={width}
                onChange={e => setWidth(e.target.value)}
                placeholder="48"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-roots-secondary focus:outline-none"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Length (in)
              </label>
              <input
                type="number"
                value={length}
                onChange={e => setLength(e.target.value)}
                placeholder="96"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-roots-secondary focus:outline-none"
                style={{ fontSize: 'max(16px, 0.875rem)' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Drip irrigation, full sun, deer fence…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-roots-secondary focus:outline-none resize-none"
              style={{ fontSize: 'max(16px, 0.875rem)' }}
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-roots-gray font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isUploading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-roots-secondary text-white font-semibold hover:bg-roots-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialBed ? 'Save changes' : 'Add bed'}
          </button>
        </div>
      </div>
    </div>
  );
}
