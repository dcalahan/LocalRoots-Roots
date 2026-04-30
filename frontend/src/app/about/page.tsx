'use client';

/**
 * About hub — index page for the /about/* surface.
 *
 * Built Apr 30 2026 (Doug). Before this, the header's "About" link routed
 * directly to /about/vision and the other /about/* pages (story,
 * tokenomics) were essentially undiscoverable. Doug went looking for the
 * tokenomics link from /ambassador and couldn't find it — that's the
 * problem this page solves.
 *
 * Discoverability strategy (see also footer "Tokenomics" link and the
 * /ambassador page's compensation section):
 *   - Footer link: visible on every page, lowest promotional weight.
 *   - About hub (this page): one click in from header, audience-neutral.
 *   - Ambassador surface: actively links to Tokenomics for the audience
 *     that needs it most (ambassadors recruiting / pitching).
 *
 * Regulatory framing rules (CLAUDE.md "Tokenomics: Proposed, Not Final"):
 *   - Allocation chart on /about/tokenomics labeled "Proposed (Subject to
 *     Change)" — the card title here mirrors that.
 *   - No specific token launch dates ("spring 2027" etc.) on this page.
 *   - No promises of token value or returns.
 *   - No "Buy ROOTS" or token-marketing CTAs anywhere.
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface AboutCardProps {
  href: string;
  emoji: string;
  title: string;
  description: string;
  external?: boolean;
}

function AboutCard({ href, emoji, title, description, external }: AboutCardProps) {
  const inner = (
    <Card className="h-full hover:border-roots-primary/40 hover:shadow-md transition-all cursor-pointer">
      <CardContent className="p-6">
        <div className="text-3xl mb-3">{emoji}</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-roots-gray">{description}</p>
        <p className="text-sm text-roots-primary mt-3 font-medium">Learn more →</p>
      </CardContent>
    </Card>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  );
}

export default function AboutHubPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-primary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            About LocalRoots
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            Neighbors feeding neighbors — built as decentralized infrastructure, not a company.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <AboutCard
            href="/about/vision"
            emoji="🌱"
            title="Our Vision"
            description="Why local food networks matter, what we're building, and how it fits into a more resilient food system."
          />
          <AboutCard
            href="/about/story"
            emoji="📖"
            title="Our Story"
            description="How LocalRoots started, who's building it, and the path from idea to live marketplace."
          />
          <AboutCard
            href="/about/tokenomics"
            emoji="🪙"
            title="Tokenomics (Proposed)"
            description="How Roots Points work today, how they'll convert to $ROOTS at token launch, and the proposed allocation. Subject to change."
          />
          <AboutCard
            href="/terms"
            emoji="⚖️"
            title="Terms & Decentralization"
            description="The protocol-not-a-service framing, how disputes are resolved on-chain by ambassador voting, and what LocalRoots is and isn't legally responsible for."
          />
        </div>

        {/* Quick context — short paragraph reinforcing the regulatory
            posture without being preachy. Anyone reading the About surface
            should understand: marketplace is live, token is later, and
            we're not promising anyone anything specific yet. */}
        <Card className="bg-roots-secondary/5 border-roots-secondary/30">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-roots-secondary mb-2">Where things stand today</h2>
            <p className="text-sm text-roots-gray mb-3">
              The marketplace is live on Base mainnet. Sellers list, buyers buy, and ambassadors earn for
              recruiting both — all on-chain, all peer-to-peer. LocalRoots takes no platform fee and never
              custodies funds.
            </p>
            <p className="text-sm text-roots-gray">
              The $ROOTS token has not launched. Sellers and ambassadors earn <strong>Roots Points</strong> in
              the meantime, which will convert to $ROOTS when the token goes live. Token launch timing,
              allocation percentages, and conversion rates are all <em>proposed and subject to change</em> until
              the contracts deploy.
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-xs text-roots-gray">
            Questions?{' '}
            <a
              href="mailto:feedback@localroots.love?subject=LocalRoots Question"
              className="text-roots-primary hover:underline font-medium"
            >
              Send us a note
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
