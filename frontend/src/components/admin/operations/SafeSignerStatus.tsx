'use client';

import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import type { SafeInfo } from '@/lib/safe';

interface SafeSignerStatusProps {
  isSigner: boolean;
  safeInfo: SafeInfo | null;
}

export function SafeSignerStatus({ isSigner, safeInfo }: SafeSignerStatusProps) {
  const { address } = useAccount();

  if (!safeInfo) return null;

  return (
    <Card className={isSigner ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
              isSigner ? 'bg-green-100' : 'bg-gray-100'
            }`}
          >
            {isSigner ? '🔑' : '👁️'}
          </div>

          {/* Status Details */}
          <div className="flex-1">
            <h4 className="font-semibold">
              {isSigner ? 'You are a Safe Signer' : 'View Only Access'}
            </h4>
            <p className="text-sm text-roots-gray">
              {isSigner
                ? 'You can sign and execute treasury transactions.'
                : 'You can view treasury status but cannot sign transactions.'}
            </p>

            {/* Signer List */}
            <div className="mt-3">
              <p className="text-xs font-medium text-roots-gray mb-2">
                Safe Signers ({safeInfo.threshold} of {safeInfo.owners.length} required):
              </p>
              <div className="flex flex-wrap gap-2">
                {safeInfo.owners.map((owner) => {
                  const isCurrentUser = owner.toLowerCase() === address?.toLowerCase();
                  return (
                    <span
                      key={owner}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                        isCurrentUser
                          ? 'bg-green-200 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {owner.slice(0, 6)}...{owner.slice(-4)}
                      {isCurrentUser && <span className="text-green-600">✓</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
