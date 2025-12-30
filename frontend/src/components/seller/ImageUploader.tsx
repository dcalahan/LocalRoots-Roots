'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Stock photos for seller profiles
const STOCK_PHOTOS = [
  { id: 'garden-1', url: '/images/stock/garden-1.jpg', alt: 'Garden beds with vegetables' },
  { id: 'garden-2', url: '/images/stock/garden-2.jpg', alt: 'Home garden with tomatoes' },
  { id: 'garden-3', url: '/images/stock/garden-3.jpg', alt: 'Raised bed garden' },
  { id: 'garden-4', url: '/images/stock/garden-4.jpg', alt: 'Backyard produce' },
  { id: 'garden-5', url: '/images/stock/garden-5.jpg', alt: 'Fresh vegetables' },
  { id: 'garden-6', url: '/images/stock/garden-6.jpg', alt: 'Organic garden' },
];

interface ImageUploaderProps {
  onUpload: (ipfsHash: string | null) => void;
  currentHash?: string;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  showStockPhotos?: boolean;
}

export function ImageUploader({
  onUpload,
  currentHash,
  label = 'Upload Image',
  accept = 'image/*',
  maxSizeMB = 5,
  showStockPhotos = false,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

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
        const dataUrl = e.target?.result as string;
        setPreview(dataUrl);
        // Pass the actual data URL so it can be stored and displayed
        // In production, this would upload to IPFS and return the hash
        onUpload(dataUrl);
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

  const openMobileCamera = () => {
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Desktop camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      setShowCamera(true);
      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setUploadError('Could not access camera. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreview(dataUrl);
      onUpload(dataUrl);
      stopCamera();
    }
  };

  const handleStockPhotoSelect = (url: string) => {
    // For stock photos, we just use the URL directly
    setPreview(url);
    onUpload(url);
    setShowStockPicker(false);
  };

  // Camera view modal
  if (showCamera) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              type="button"
              onClick={stopCamera}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="px-6 py-2 bg-roots-primary text-white rounded-lg hover:bg-roots-primary/90"
            >
              Capture
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stock photo picker modal
  if (showStockPicker) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Select a Stock Photo</h4>
            <button
              type="button"
              onClick={() => setShowStockPicker(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STOCK_PHOTOS.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => handleStockPhotoSelect(photo.url)}
                className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-roots-primary transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.alt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image doesn't exist
                    (e.target as HTMLImageElement).src = `https://placehold.co/200x200/4CAF50/FFFFFF?text=${encodeURIComponent(photo.alt.split(' ')[0])}`;
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            onError={(e) => {
              // Handle broken image
              (e.target as HTMLImageElement).src = 'https://placehold.co/400x200/E5E7EB/6B7280?text=Image';
            }}
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
        /* Mobile: Show buttons for camera and file picker */
        <div className="space-y-3">
          <button
            type="button"
            onClick={openMobileCamera}
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

          {showStockPhotos && (
            <button
              type="button"
              onClick={() => setShowStockPicker(true)}
              className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="font-medium text-gray-600">Choose Stock Photo</span>
            </button>
          )}

          <p className="text-xs text-center text-gray-500">
            PNG, JPG up to {maxSizeMB}MB
          </p>
        </div>
      ) : (
        /* Desktop: Show all options */
        <div className="space-y-3">
          {/* Drag and drop area */}
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
            <div className="text-center py-6">
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
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

          {/* Additional options row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="flex-1 flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Use Camera</span>
            </button>

            {showStockPhotos && (
              <button
                type="button"
                onClick={() => setShowStockPicker(true)}
                className="flex-1 flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Stock Photos</span>
              </button>
            )}
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
