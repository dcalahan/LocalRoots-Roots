'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-roots-cream border-t border-roots-gray/20 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left side - branding */}
          <div className="text-sm text-roots-gray">
            <span className="font-medium">Local Roots</span> — Neighbors Feeding Neighbors
          </div>

          {/* Right side - links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/about"
              className="text-roots-gray hover:text-roots-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/government"
              className="text-roots-gray hover:text-roots-primary transition-colors"
            >
              Government
            </Link>
            <a
              href="mailto:feedback@localroots.love?subject=LocalRoots Feedback"
              className="text-roots-primary hover:text-roots-primary/80 transition-colors font-medium"
            >
              Send Feedback
            </a>
          </div>
        </div>

        {/* Bottom row - testnet note */}
        <div className="mt-4 pt-4 border-t border-roots-gray/10 text-center text-xs text-roots-gray">
          Currently in beta on Base Sepolia testnet
        </div>
      </div>
    </footer>
  );
}
