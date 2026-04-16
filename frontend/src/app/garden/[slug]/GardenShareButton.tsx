'use client';

import { useState } from 'react';

interface GardenShareButtonProps {
  name: string;
  tagline: string;
  slug: string;
}

export function GardenShareButton({ name, tagline, slug }: GardenShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const url = `https://www.localroots.love/garden/${slug}`;

  async function handleShare() {
    const shareData = { title: name, text: tagline, url };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed silently
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 text-roots-cream/70 hover:text-white transition-colors"
      title="Share this garden"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span className="text-xs">{copied ? 'Copied!' : 'Share'}</span>
    </button>
  );
}
