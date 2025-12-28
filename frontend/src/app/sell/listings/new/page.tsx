'use client';

import { useRouter } from 'next/navigation';
import { CreateListingForm } from '@/components/seller/CreateListingForm';

export default function CreateListingPage() {
  const router = useRouter();

  // For MVP, skip wallet checks - let users add listings first
  // Wallet connection will happen at checkout/publish time

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/sell/dashboard')}
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
              Back to Dashboard
            </button>
          </div>

          <CreateListingForm />
        </div>
      </div>
    </div>
  );
}
