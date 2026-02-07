'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    // Check if user has dismissed the banner this session
    const wasDismissed = sessionStorage.getItem('testnet-banner-dismissed');
    setDismissed(wasDismissed === 'true');
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('testnet-banner-dismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium relative">
      <span>
        🧪 <strong>Preview Mode</strong> — We're still building! Explore freely — no real money changes hands.
      </span>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-amber-600/20 rounded"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
