'use client';

import { useState } from 'react';

interface DisputeEvidenceProps {
  title: string;
  reason: string;
  evidenceIpfs?: string;
  isLoading?: boolean;
}

export function DisputeEvidence({
  title,
  reason,
  evidenceIpfs,
  isLoading = false,
}: DisputeEvidenceProps) {
  const [imageError, setImageError] = useState(false);

  // Convert IPFS hash to gateway URL
  const getImageUrl = (ipfsHash: string) => {
    if (!ipfsHash) return null;
    // Handle both raw hashes and ipfs:// URIs
    const hash = ipfsHash.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  };

  const imageUrl = evidenceIpfs ? getImageUrl(evidenceIpfs) : null;

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-16 bg-gray-200 rounded mb-3" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-sm text-roots-gray mb-2">{title}</h4>

      {/* Reason/Response Text */}
      <p className="text-sm mb-3 whitespace-pre-wrap">{reason || 'No statement provided'}</p>

      {/* Evidence Image */}
      {imageUrl && !imageError ? (
        <div className="relative">
          <img
            src={imageUrl}
            alt={`Evidence for ${title}`}
            className="w-full max-h-64 object-contain rounded-lg border bg-white"
            onError={() => setImageError(true)}
          />
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 bg-white/90 hover:bg-white px-2 py-1 rounded text-xs text-roots-gray hover:text-roots-primary transition-colors"
          >
            View full size
          </a>
        </div>
      ) : evidenceIpfs && imageError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">Failed to load evidence image</p>
          <a
            href={imageUrl || ''}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-roots-primary hover:underline"
          >
            Try viewing directly
          </a>
        </div>
      ) : (
        <p className="text-xs text-roots-gray italic">No photo evidence provided</p>
      )}
    </div>
  );
}
