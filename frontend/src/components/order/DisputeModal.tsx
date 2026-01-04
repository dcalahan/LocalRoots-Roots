'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useRaiseDispute } from '@/hooks/useOrderActions';
import { uploadImage, uploadMetadata } from '@/lib/pinata';

interface DisputeModalProps {
  orderId: bigint;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DisputeModal({ orderId, productName, onClose, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { raiseDispute, isDisputing, error } = useRaiseDispute();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    setIsUploading(true);

    try {
      // Upload image to IPFS if provided
      let imageIpfs = '';
      if (selectedImage) {
        const result = await uploadImage(selectedImage);
        imageIpfs = result.ipfsHash;
      }

      // Upload dispute metadata to IPFS
      const disputeData = {
        orderId: orderId.toString(),
        reason: reason.trim(),
        evidenceImage: imageIpfs ? `ipfs://${imageIpfs}` : null,
        submittedAt: new Date().toISOString(),
      };

      await uploadMetadata(disputeData, `dispute-${orderId.toString()}`);

      // Raise the dispute on-chain
      const success = await raiseDispute(orderId);
      if (success) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to submit dispute:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitting = isUploading || isDisputing;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-heading font-bold mb-2">Report an Issue</h2>
          <p className="text-roots-gray text-sm mb-4">
            Order #{orderId.toString()} - {productName}
          </p>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Raising a dispute will put a hold on payment to the seller.
              Our team will review the case and may contact you for more information.
            </p>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              What went wrong?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue (e.g., product not as described, wrong items, quality issues)..."
              className="w-full p-3 border rounded-lg h-28 resize-none focus:ring-2 focus:ring-roots-primary focus:border-transparent"
              disabled={isSubmitting}
            />
          </div>

          {/* Photo Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Add Photo Evidence (optional but recommended)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isSubmitting}
            />

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Evidence"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1 hover:bg-white"
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-roots-primary hover:text-roots-primary transition-colors"
                disabled={isSubmitting}
              >
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">Tap to take a photo</span>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
