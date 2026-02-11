'use client';

import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAirdropClaim, formatSeedsForDisplay, formatRootsForDisplay } from '@/hooks/useAirdropClaim';
import { UnifiedWalletButton } from '@/components/UnifiedWalletButton';
import { ExternalLink, Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const {
    isEligible,
    claimInfo,
    hasClaimed,
    airdropStatus,
    isAirdropActive,
    isCheckingEligibility,
    isClaiming,
    claimTxHash,
    claimError,
    claimSuccess,
    claim,
    refetch,
  } = useAirdropClaim();

  // Format time remaining
  const formatTimeRemaining = (seconds: bigint): string => {
    const days = Number(seconds) / 86400;
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months === 1 ? '' : 's'}`;
    }
    if (days > 1) {
      return `${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'}`;
    }
    const hours = Math.floor(Number(seconds) / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  };

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Claim Your $ROOTS</h1>
          <p className="text-roots-gray">
            Convert your Seeds earned during Phase 1 into $ROOTS tokens
          </p>
        </div>

        {/* Not Connected */}
        {!isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Connect the wallet you used to earn Seeds to check your eligibility
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <UnifiedWalletButton />
            </CardContent>
          </Card>
        )}

        {/* Loading Eligibility */}
        {isConnected && isCheckingEligibility && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-roots-primary mx-auto mb-4" />
              <p className="text-roots-gray">Checking your eligibility...</p>
            </CardContent>
          </Card>
        )}

        {/* Airdrop Not Active */}
        {isConnected && !isCheckingEligibility && !isAirdropActive && (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 text-roots-gray mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Airdrop Not Yet Active
              </h3>
              <p className="text-roots-gray mb-4">
                The $ROOTS token airdrop hasn&apos;t started yet. Keep earning Seeds - they&apos;ll
                convert to $ROOTS when we launch!
              </p>
              <Link href="/sell/dashboard">
                <Button variant="outline">View Your Seeds</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Already Claimed */}
        {isConnected && !isCheckingEligibility && hasClaimed && !claimSuccess && (
          <Card className="border-roots-secondary">
            <CardContent className="py-12 text-center">
              <Check className="h-12 w-12 text-roots-secondary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Already Claimed
              </h3>
              <p className="text-roots-gray mb-4">
                You&apos;ve already claimed your $ROOTS tokens for this wallet.
              </p>
              <div className="text-sm text-roots-gray">
                Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Eligible */}
        {isConnected && !isCheckingEligibility && isAirdropActive && !isEligible && !hasClaimed && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-roots-gray mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Seeds Found
              </h3>
              <p className="text-roots-gray mb-4">
                This wallet didn&apos;t earn any Seeds during Phase 1.
              </p>
              <p className="text-sm text-roots-gray mb-6">
                Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Check Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Eligible - Can Claim */}
        {isConnected && !isCheckingEligibility && isEligible && claimInfo && (
          <div className="space-y-6">
            {/* Claim Card */}
            <Card className="border-roots-primary">
              <CardHeader>
                <CardTitle className="text-roots-primary">You&apos;re Eligible!</CardTitle>
                <CardDescription>
                  You earned Seeds during Phase 1 and can now claim $ROOTS tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seeds → ROOTS Conversion */}
                <div className="bg-roots-cream rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-roots-gray">Seeds Earned</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatSeedsForDisplay(claimInfo.seedsEarned)}
                      </p>
                    </div>
                    <div className="text-2xl text-roots-gray">→</div>
                    <div className="text-right">
                      <p className="text-sm text-roots-gray">$ROOTS to Claim</p>
                      <p className="text-2xl font-bold text-roots-primary">
                        {formatRootsForDisplay(claimInfo.rootsAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Claim Button */}
                <Button
                  onClick={claim}
                  disabled={isClaiming}
                  className="w-full bg-roots-primary hover:bg-roots-primary/90 text-white py-6 text-lg"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {claimTxHash ? 'Confirming...' : 'Claiming...'}
                    </>
                  ) : (
                    'Claim $ROOTS'
                  )}
                </Button>

                {/* Transaction Link */}
                {claimTxHash && !claimSuccess && (
                  <div className="text-center">
                    <a
                      href={`https://sepolia.basescan.org/tx/${claimTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-roots-secondary hover:underline inline-flex items-center"
                    >
                      View on BaseScan
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Error */}
                {claimError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Claim Failed</AlertTitle>
                    <AlertDescription>{claimError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Time Remaining */}
            {airdropStatus && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-roots-gray">Time remaining to claim</span>
                    <span className="font-medium text-gray-900">
                      {formatTimeRemaining(airdropStatus.timeUntilDeadline)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Success State */}
        {claimSuccess && claimInfo && (
          <Card className="border-roots-secondary">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-roots-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-roots-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Claim Successful!
              </h3>
              <p className="text-roots-gray mb-4">
                You&apos;ve claimed{' '}
                <span className="font-semibold text-roots-primary">
                  {formatRootsForDisplay(claimInfo.rootsAmount)} $ROOTS
                </span>
              </p>

              {claimTxHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${claimTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-roots-secondary hover:underline inline-flex items-center mb-6"
                >
                  View transaction
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-roots-gray mb-4">
                  Your $ROOTS tokens are now in your wallet. Use them to purchase from local
                  growers or hold for future benefits.
                </p>
                <Link href="/buy">
                  <Button className="bg-roots-secondary hover:bg-roots-secondary/90">
                    Shop Local Produce
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <div className="mt-8 text-center text-sm text-roots-gray">
          <p>
            Seeds were earned by sellers, buyers, and ambassadors during Phase 1.
          </p>
          <p className="mt-1">
            The conversion ratio is based on total Seeds distributed.
          </p>
        </div>
      </div>
    </div>
  );
}
