'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FounderStoryPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-primary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why I Started LocalRoots
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            A twenty-year journey from warning to action
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* A Warning I Couldn't Shake */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">A Warning I Couldn't Shake</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              In 2008, I attended a presentation by economist Brian Beaulieu of ITR Economics.
              He and his brother Alan had built a reputation for remarkably accurate economic
              forecasting — their firm maintains a 94.7% accuracy rate at four quarters out.
            </p>
            <p className="mb-4">
              That day, Brian wasn't talking about the next quarter or even the next year.
              He was talking about the 2030s. He laid out the case that demographic trends,
              debt levels, and economic cycles were converging toward a global depression —
              not a recession, a depression — hitting around 2030.
            </p>
            <p>
              I walked out of that room unsettled. Not panicked, but changed. The question
              lodged in my mind: <em>If he's right, what should I be doing now?</em>
            </p>
          </div>
        </section>

        {/* The Idea That Wouldn't Leave */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Idea That Wouldn't Leave</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Over the years, I kept coming back to the same thought: communities with local
              food networks would be more resilient than those entirely dependent on global
              supply chains.
            </p>
            <p className="mb-4">
              It wasn't complicated. If your neighborhood has people who know how to grow food,
              and systems for trading that food with each other, you have options. If you're
              entirely dependent on trucks from a thousand miles away stocking shelves at a
              store you don't control, you're exposed.
            </p>
            <p className="mb-4">
              The 2020 pandemic gave everyone a glimpse of what supply chain disruption looks
              like. Empty shelves. Farmers dumping produce while families went without. A system
              optimized for efficiency, completely unprepared for shock.
            </p>
            <p className="font-semibold text-gray-900">
              But I'd been thinking about this for twelve years by then.
            </p>
          </div>
        </section>

        {/* Harry */}
        <section className="mb-12">
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-6">
              <h2 className="text-3xl font-bold mb-6 text-gray-900">Harry</h2>
              <div className="prose prose-lg text-roots-gray">
                <p className="mb-4">
                  My college roommate was a guy named Harry Weller. After Duke, Harry went on to
                  Harvard Business School, then became a Navy pilot, then built one of the most
                  successful careers in venture capital. He led NEA's East Coast practice and
                  made the Forbes Midas List nine years running. He backed companies like Groupon,
                  Eloqua, and SourceFire.
                </p>
                <p className="mb-4">
                  Harry was brilliant, but what I remember most was his instinct for ideas that
                  mattered. He could see around corners.
                </p>
                <p className="mb-4">
                  When I told Harry about LocalRoots — the idea of building decentralized local
                  food networks before communities needed them — he got it immediately. He believed
                  in it. He saw what I saw: that this wasn't about building a company, it was
                  about building resilience.
                </p>
                <p className="text-gray-900 font-medium">
                  On November 19, 2016, Harry died unexpectedly in his sleep. He was 46.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* A Promise to Keep */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">A Promise to Keep</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              After Harry passed, the idea sat differently with me. It wasn't just an interesting
              concept anymore. It was something Harry believed in. Something worth building.
            </p>
            <p className="mb-4">
              I decided that when I launched LocalRoots, I would do it on the ten-year anniversary
              of Harry's death. November 2026.
            </p>
            <p>
              Not because the timing is convenient — launching a token into a bear market isn't
              ideal, which is why we're doing a soft launch first with stablecoin payments.
              But because some things matter more than optimization.
            </p>
            <p className="font-semibold text-roots-primary mt-4">
              Harry believed in this. I'm going to build it.
            </p>
          </div>
        </section>

        {/* What We're Building */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What We're Building</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              LocalRoots is a marketplace connecting backyard gardeners with neighbors who want
              local food. But the marketplace is just the mechanism.
            </p>
            <p className="mb-4">
              The real goal is getting more people growing. Every new gardener strengthens their
              community. Every backyard that produces food is resilience that didn't exist before.
            </p>
            <p>
              We're using blockchain technology not because crypto is trendy, but because it lets
              us build infrastructure that no single company controls. If LocalRoots disappeared
              tomorrow, the networks we've helped create should continue. That's the point.
            </p>
          </div>
        </section>

        {/* The Timeline */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Timeline</h2>
          <div className="prose prose-lg text-roots-gray mb-6">
            <p>
              Brian Beaulieu's forecast points to economic trouble in the early 2030s, with a
              bottom around 2036. ITR Economics has been consistent on this thesis since their
              2014 book "Prosperity in the Age of Decline."
            </p>
            <p>
              Whether they're exactly right or not, the preparation is the same. Build local
              food networks now. Get more people growing. Strengthen communities before they need it.
            </p>
          </div>

          <div className="space-y-4">
            <Card className="border-l-4 border-l-roots-primary">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🚀</div>
                  <div>
                    <p className="font-bold text-gray-900">November 2026</p>
                    <p className="text-roots-gray">
                      LocalRoots soft launch. USDC payments. Real marketplace, real transactions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-roots-secondary">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🪙</div>
                  <div>
                    <p className="font-bold text-gray-900">Q1 2028</p>
                    <p className="text-roots-gray">
                      Token launch. Reward everyone who helped build the network early.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🌍</div>
                  <div>
                    <p className="font-bold text-gray-900">2030 and Beyond</p>
                    <p className="text-roots-gray">
                      Communities with strong local food networks weather whatever comes better
                      than those without.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Join Me */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 border-roots-primary">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4 text-center">Join Me</h2>
              <div className="prose prose-lg text-roots-gray text-center">
                <p className="mb-4">
                  I've been thinking about this for almost twenty years. I'm building it to
                  honor a friend who believed in it. And I'm convinced it matters.
                </p>
                <p className="mb-4">
                  If you grow food, sell on LocalRoots. If you don't grow yet, start — we'll
                  help you learn. If you believe in building resilient communities, become
                  an ambassador.
                </p>
                <p className="font-semibold text-roots-primary">
                  The future is uncertain. But neighbors who grow together, weather storms together.
                </p>
                <p className="mt-6 text-gray-900 font-medium">— Doug</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <Link href="/buy">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Browse Local Produce
            </Button>
          </Link>
          <Link href="/sell">
            <Button variant="outline">
              Start Selling
            </Button>
          </Link>
          <Link href="/ambassador">
            <Button variant="outline">
              Become an Ambassador
            </Button>
          </Link>
        </div>

        {/* Read Vision Link */}
        <div className="text-center border-t pt-8">
          <p className="text-roots-gray mb-4">
            Learn more about what we're building
          </p>
          <Link href="/about/vision">
            <Button variant="link" className="text-roots-primary">
              Read Our Vision →
            </Button>
          </Link>
        </div>

        {/* Memorial */}
        <div className="text-center mt-12 pt-8 border-t">
          <p className="text-roots-gray italic">
            In memory of Harry Weller (1970-2016)
          </p>
        </div>
      </main>
    </div>
  );
}
