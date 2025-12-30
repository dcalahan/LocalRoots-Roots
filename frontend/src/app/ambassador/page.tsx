'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';

export default function AmbassadorPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-roots-primary/10 to-white">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-6">🌟</div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Local Roots Ambassadors
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto mb-4">
            Build a more resilient community - one gardener at a time.
          </p>
          <p className="text-lg text-roots-gray max-w-2xl mx-auto">
            Ambassadors inspire neighbors to grow food, help them share their harvest,
            and earn $ROOTS as local food production flourishes. When our community grows more,
            we all become stronger.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* The Mission */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-green-50 to-roots-primary/5 border-green-200">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-center mb-4">The Mission: Community Food Resilience</h2>
              <p className="text-center text-roots-gray max-w-2xl mx-auto">
                What happens when supply chains break? When grocery stores can't stock shelves?
                <strong className="text-gray-900"> Communities that grow their own food thrive.</strong>
              </p>
              <p className="text-center text-roots-gray max-w-2xl mx-auto mt-4">
                Local Roots isn't just a marketplace - it's a movement to get more people growing food,
                sharing with neighbors, and building the local food networks that make communities resilient.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Why Ambassadors Matter */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">What Ambassadors Do</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-roots-primary">
              <CardHeader>
                <div className="text-4xl mb-2">🌱</div>
                <CardTitle>Inspire People to Grow</CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                <strong className="text-roots-primary">This is the #1 job.</strong> Some neighbors already garden -
                help them see value in growing a little more. Others have never tried - show them how easy it can be.
                <em className="block mt-2 text-sm">Every new grower makes our community stronger.</em>
              </CardContent>
            </Card>

            <Card className="border-2 border-roots-primary">
              <CardHeader>
                <div className="text-4xl mb-2">🤝</div>
                <CardTitle>Connect Growers to Neighbors</CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                Help gardeners share their harvest through Local Roots. Set up their wallets,
                create listings, take photos. Turn that extra zucchini into $ROOTS tokens -
                and motivation to plant more next season.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-4xl mb-2">📈</div>
                <CardTitle>Encourage More Production</CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                When gardeners earn from their harvest, they grow more. When they grow more, the whole
                community benefits. Help your sellers expand - more beds, more variety, eventually
                even <strong>homemade foods</strong> like jams, pickles, and casseroles.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-4xl mb-2">⚖️</div>
                <CardTitle>Keep the Community Trusted</CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                Handle disputes fairly when they arise. A trusted marketplace grows faster.
                Your fairness and judgment keep Local Roots a place where neighbors want to
                buy and sell.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Practical Guide */}
        <section className="mb-16">
          <Card className="bg-roots-primary/5 border-roots-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl text-center">How to Build Your Local Food Network</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-roots-primary text-lg">🔍</span> Find & Inspire Growers
                  </h4>
                  <ul className="text-sm text-roots-gray space-y-2">
                    <li>• Spot backyard gardens on walks around the neighborhood</li>
                    <li>• Talk to folks at farmers markets and community gardens</li>
                    <li>• "Extra produce" posts on Nextdoor? That's your cue!</li>
                    <li>• Encourage non-gardeners: "You have a sunny yard..."</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-roots-primary text-lg">🚀</span> Get Them Started
                  </h4>
                  <ul className="text-sm text-roots-gray space-y-2">
                    <li>• Walk them through wallet setup (be patient!)</li>
                    <li>• Help create their first listing together</li>
                    <li>• Take good photos of their produce</li>
                    <li>• Show them how $ROOTS becomes real value</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-roots-primary text-lg">📈</span> Help Them Grow More
                  </h4>
                  <ul className="text-sm text-roots-gray space-y-2">
                    <li>• Check in: "What are you planting next season?"</li>
                    <li>• Connect them with other local growers</li>
                    <li>• Suggest expanding: "Your neighbors love your tomatoes!"</li>
                    <li>• Introduce the idea of homemade goods (jams, pickles...)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-roots-primary text-lg">🍳</span> The Future: Homemade Foods
                  </h4>
                  <ul className="text-sm text-roots-gray space-y-2">
                    <li>• Help producers expand into prepared foods</li>
                    <li>• Casseroles, baked goods, preserves, sauces</li>
                    <li>• Guide them on local cottage food laws</li>
                    <li>• More production = more community resilience</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Ambassador Rewards */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Ambassador Rewards</h2>

          {/* Main reward - 1 year commission */}
          <Card className="mb-6 border-2 border-roots-primary bg-gradient-to-r from-roots-primary/5 to-roots-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="text-3xl">💰</span> 1 Year of Earnings Per Seller
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-roots-gray mb-4">
                When you onboard a new seller, you earn a percentage of their sales
                <strong className="text-roots-primary"> for their first full year</strong> on Local Roots.
                This rewards you for building the community - and keeps you motivated to find more growers!
              </p>
              <div className="bg-white rounded-lg p-4 border">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-roots-primary mb-1">25%</div>
                    <div className="text-sm text-roots-gray">of each seller's sales</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-roots-primary mb-1">1 Year</div>
                    <div className="text-sm text-roots-gray">per seller you onboard</div>
                  </div>
                </div>
                <div className="text-xs text-roots-gray mt-3 text-center">Paid automatically from the $ROOTS treasury</div>
              </div>
              <div className="mt-4 p-3 bg-roots-primary/10 rounded-lg">
                <p className="text-sm text-roots-gray">
                  <strong>Example:</strong> Onboard 10 sellers in Year 1. Each sells $100/month.
                  That's <strong className="text-roots-primary">$250/month in $ROOTS</strong>.
                  Keep recruiting to keep your earnings growing!
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔄</span> Keep Growing, Keep Earning
                </CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                <p className="mb-4">
                  The 1-year reward window means successful ambassadors are always recruiting:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Onboard 10 sellers in Year 1 → earn from all 10</li>
                  <li>• Onboard 10 more in Year 2 → earn from 20 sellers</li>
                  <li>• Year 1 sellers "age out" → but you've added more!</li>
                  <li>• <strong>Steady recruiting = steady income</strong></li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span> Recognition & Community
                </CardTitle>
              </CardHeader>
              <CardContent className="text-roots-gray">
                <p className="mb-4">
                  Ambassadors are recognized leaders:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Special Ambassador badge on profile</li>
                  <li>• Leaderboard ranking by sellers onboarded</li>
                  <li>• Ambassador Discord for tips & coordination</li>
                  <li>• Early access to new features</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Recruit Other Ambassadors */}
        <section className="mb-16">
          <Card className="border-2 border-roots-secondary bg-gradient-to-r from-roots-secondary/5 to-roots-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="text-3xl">👥</span> Grow Your Ambassador Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-roots-gray mb-4">
                Ambassadors can recruit other ambassadors and earn from their success too.
                When someone you recruit onboards sellers, <strong className="text-roots-primary">you earn a commission on their earnings</strong>.
              </p>
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-sm text-roots-gray">
                  <strong>How it works:</strong> You recruit Alice as an ambassador. Alice onboards 5 sellers.
                  Alice earns 25% of her sellers' sales - and you earn a percentage of Alice's ambassador earnings.
                  Build a team of ambassadors and multiply your impact on community food resilience.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* How to Become an Ambassador */}
        <section className="mb-16">
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Become an Ambassador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-8">
                <p className="text-roots-gray max-w-xl mx-auto">
                  <strong className="text-roots-primary">Anyone can become an Ambassador.</strong> No approval needed.
                  The more ambassadors we have, the faster we build community food resilience.
                  Connect your wallet and start today.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                    1
                  </div>
                  <h4 className="font-semibold mb-1">Connect Wallet</h4>
                  <p className="text-sm text-roots-gray">
                    Connect your wallet to get started
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                    2
                  </div>
                  <h4 className="font-semibold mb-1">Register as Ambassador</h4>
                  <p className="text-sm text-roots-gray">
                    Sign up and get your unique referral link
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                    3
                  </div>
                  <h4 className="font-semibold mb-1">Start Building</h4>
                  <p className="text-sm text-roots-gray">
                    Recruit growers and other ambassadors
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-roots-gray mb-4">
                  Ambassador program launching soon. Join the waitlist to be notified.
                </p>
                <Button disabled className="bg-roots-primary/50 cursor-not-allowed">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Back to Home */}
        <div className="text-center">
          <Link href="/">
            <Button variant="outline">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
