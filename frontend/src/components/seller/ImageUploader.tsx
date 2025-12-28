'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ImageUploaderProps {
  onUpload: (ipfsHash: string | null) => void;
  currentHash?: string;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
}

export function ImageUploader({
  onUpload,
  currentHash,
  label = 'Upload Image',
  accept = 'image/*',
  maxSizeMB = 5,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setSizeError(null);
      setUploadError(null);

      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setSizeError(`File size must be less than ${maxSizeMB}MB`);
        return;
      }

      // Create preview immediately (no upload needed for MVP)
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
        // For now, just use the data URL as a placeholder
        // In production, this would upload to IPFS
        onUpload(`local:${file.name}`);
      };
      reader.readAsDataURL(file);
    },
    [onUpload, maxSizeMB]
  );

  const handleRemove = useCallback(() => {
    setPreview(null);
    setSizeError(null);
    setUploadError(null);
    onUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, [onUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {preview ? (
        /* Preview with remove button */
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : isMobile ? (
        /* Mobile: Show two buttons */
        <div className="space-y-3">
          <button
            type="button"
            onClick={openCamera}
            className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-roots-primary rounded-lg bg-roots-primary/5 hover:bg-roots-primary/10 transition-colors"
          >
            <svg className="w-6 h-6 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-roots-primary">Take Photo</span>
          </button>

          <button
            type="button"
            onClick={openFilePicker}
            className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-gray-600">Choose from Library</span>
          </button>

          <p className="text-xs text-center text-gray-500">
            PNG, JPG up to {maxSizeMB}MB
          </p>
        </div>
      ) : (
        /* Desktop: Drag and drop area */
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer
            ${dragActive ? 'border-roots-primary bg-roots-primary/5' : 'border-gray-300'}
            hover:border-gray-400
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFilePicker}
        >
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-2 text-sm text-gray-600">
              <span className="text-roots-primary font-medium">Click to upload</span>
              {' '}or drag and drop
            </div>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, GIF up to {maxSizeMB}MB
            </p>
          </div>
        </div>
      )}

      {sizeError && (
        <p className="text-sm text-red-600">{sizeError}</p>
      )}

      {uploadError && (
        <p className="text-sm text-red-600">{uploadError}</p>
      )}
    </div>
  );
}
