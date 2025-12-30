'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSellerStatus } from '@/hooks/useSellerStatus';

export default function SellerPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isSeller, sellerId, isLoading } = useSellerStatus();

  // Redirect to dashboard if registered seller
  useEffect(() => {
    if (isConnected && !isLoading && isSeller) {
      router.replace('/sell/dashboard');
    }
  }, [isConnected, isLoading, isSeller, router]);

  // Show loading while checking seller status
  if (isConnected && isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12">
              <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-roots-gray">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (isConnected && isSeller) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12">
              <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-roots-gray">Redirecting to dashboard...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Default: Show marketing page (no wallet required)
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero Section */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Feed Your Neighbors
            </h1>
            <p className="text-xl text-roots-gray mb-8">
              Local Roots connects home gardeners with neighbors who want fresh,
              locally-grown produce. No middlemen, no shipping — just neighbors
              helping neighbors eat better.
            </p>
            <Link href="/sell/register">
              <Button size="lg" className="bg-roots-primary hover:bg-roots-primary/90 text-lg px-8 py-6">
                Start Selling Today
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="font-heading text-3xl font-bold text-center mb-12">
          Why Gardeners Love Local Roots
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">Share What You Love</h3>
              <p className="text-roots-gray">
                That feeling when a neighbor tastes your heirloom tomatoes for
                the first time? Priceless. Share your passion with people who appreciate it.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-roots-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-roots-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">Build Community</h3>
              <p className="text-roots-gray">
                Your buyers aren&apos;t strangers — they&apos;re the folks down the street.
                Build real connections over fresh food.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold mb-3">Earn From Your Garden</h3>
              <p className="text-roots-gray">
                Turn your extra harvest into extra income. You set your prices
                and keep what you earn.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 border-y">
        <div className="container mx-auto px-4 py-16">
          <h2 className="font-heading text-3xl font-bold text-roots-primary text-center mb-12">
            How it Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="text-5xl font-light text-gray-300 mb-4">1</div>
              <div className="w-20 h-20 bg-roots-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold mb-2">Create Your Profile</h3>
              <p className="text-sm text-roots-gray">
                Tell neighbors about your garden and what you grow.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="text-5xl font-light text-gray-300 mb-4">2</div>
              <div className="w-20 h-20 bg-roots-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold mb-2">List Your Produce</h3>
              <p className="text-sm text-roots-gray">
                Add photos and set prices for what you&apos;re selling.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="text-5xl font-light text-gray-300 mb-4">3</div>
              <div className="w-20 h-20 bg-roots-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold mb-2">Get Paid</h3>
              <p className="text-sm text-roots-gray">
                Hand off to neighbors and receive payment directly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-roots-gray mb-8">
            Join your neighbors in building a more connected, sustainable food system.
          </p>
          <Link href="/sell/register">
            <Button size="lg" className="bg-roots-primary hover:bg-roots-primary/90 text-lg px-8 py-6">
              Create Your Seller Profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

