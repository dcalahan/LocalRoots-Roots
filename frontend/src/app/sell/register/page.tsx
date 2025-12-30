'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { SellerRegistrationForm } from '@/components/seller/SellerRegistrationForm';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useEffect, useState } from 'react';
import { useAmbassadorById } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorProfile } from '@/hooks/useAmbassadorProfile';

function SellerRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useAccount();
  const { isSeller, isLoading } = useSellerStatus();

  // Get referral from URL params
  const refParam = searchParams.get('ref');
  const [ambassadorId, setAmbassadorId] = useState<bigint | null>(null);

  // Get ambassador details to show who referred them
  const { ambassador: referringAmbassador, isLoading: isLoadingAmbassador } = useAmbassadorById(ambassadorId);

  // Get ambassador profile from IPFS
  const { profile: ambassadorProfile, isLoading: isLoadingProfile } = useAmbassadorProfile(referringAmbassador?.profileIpfs);

  // Parse referral param and store it
  useEffect(() => {
    if (refParam) {
      try {
        const id = BigInt(refParam);
        if (id > 0n) {
          setAmbassadorId(id);
          // Store in localStorage for the form to use
          localStorage.setItem('ambassadorRef', refParam);
        }
      } catch {
        console.error('[SellerRegister] Invalid ref param:', refParam);
      }
    } else {
      // Check localStorage
      const storedRef = localStorage.getItem('ambassadorRef');
      if (storedRef) {
        try {
          const id = BigInt(storedRef);
          if (id > 0n) {
            setAmbassadorId(id);
          }
        } catch {
          // Invalid stored ref
        }
      }
    }
  }, [refParam]);

  // Redirect if already a seller
  useEffect(() => {
    if (isConnected && !isLoading && isSeller) {
      router.push('/sell');
    }
  }, [isSeller, isLoading, router, isConnected]);

  // Always show the registration form - wallet connection happens at submit time
  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/sell')}
              className="text-roots-gray hover:text-roots-primary flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
          </div>

          {/* Show ambassador referral banner */}
          {ambassadorId && !isLoadingAmbassador && referringAmbassador && referringAmbassador.active && (
            <div className="mb-4 p-4 bg-roots-primary/5 border border-roots-primary/20 rounded-lg">
              <p className="text-sm text-roots-gray">
                <span className="font-medium text-roots-primary">
                  {isLoadingProfile ? (
                    'Loading referrer...'
                  ) : ambassadorProfile?.name ? (
                    `Referred by ${ambassadorProfile.name}`
                  ) : (
                    `Referred by Ambassador #${ambassadorId.toString()}`
                  )}
                </span>
                {referringAmbassador.uplineId === 0n && (
                  <>
                    <br />
                    <span className="text-xs text-roots-primary">State Founder</span>
                  </>
                )}
              </p>
            </div>
          )}

          <SellerRegistrationForm ambassadorId={ambassadorId} />
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-roots-cream flex items-center justify-center">
      <div className="animate-pulse text-roots-gray">Loading...</div>
    </div>
  );
}

export default function SellerRegistrationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SellerRegistrationContent />
    </Suspense>
  );
}
