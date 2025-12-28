'use client';

import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { SellerRegistrationForm } from '@/components/seller/SellerRegistrationForm';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useEffect } from 'react';

export default function SellerRegistrationPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isSeller, isLoading } = useSellerStatus();

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

          <SellerRegistrationForm />
        </div>
      </div>
    </div>
  );
}
