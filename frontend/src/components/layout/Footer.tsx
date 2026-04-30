'use client';

import Link from 'next/link';
import { IS_MAINNET, NETWORK_LABEL } from '@/lib/chainConfig';

export function Footer() {
  return (
    <footer className="bg-roots-cream border-t border-roots-gray/20 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left side - branding */}
          <div className="text-sm text-roots-gray">
            <span className="font-medium">Local Roots</span> — Neighbors Feeding Neighbors
          </div>

          {/* Right side - links. Tokenomics is its own footer entry
              (not just buried under About) so anyone curious about the
              token can find it directly from any page. Discoverability,
              not promotion — see /about/page.tsx for the regulatory
              framing. (Doug, Apr 30 2026.) */}
          <div className="flex items-center gap-x-6 gap-y-2 text-sm flex-wrap justify-center">
            <Link
              href="/about"
              className="text-roots-gray hover:text-roots-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/about/tokenomics"
              className="text-roots-gray hover:text-roots-primary transition-colors"
            >
              Tokenomics
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

        {/* Network status — only shown on testnets. Mainnet hides this row. */}
        {!IS_MAINNET && (
          <div className="mt-4 pt-4 border-t border-roots-gray/10 text-center text-xs text-roots-gray">
            Currently in beta on {NETWORK_LABEL} testnet
          </div>
        )}
      </div>
    </footer>
  );
}
