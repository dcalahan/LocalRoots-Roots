'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Address } from 'viem';

interface ReceiveTokenSectionProps {
  walletAddress: Address | undefined;
}

export function ReceiveTokenSection({ walletAddress }: ReceiveTokenSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (!walletAddress) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Wallet Address',
          text: `Send tokens to my LocalRoots wallet: ${walletAddress}`,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  if (!walletAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receive</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-roots-gray text-sm">Connect your wallet to receive tokens</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Receive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <QRCodeSVG
              value={walletAddress}
              size={160}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
        </div>

        {/* Address Display */}
        <div className="text-center">
          <p className="text-sm text-roots-gray mb-1">Your wallet address</p>
          <p className="font-mono text-sm font-medium">{truncatedAddress}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Full Address (expandable on click) */}
        <details className="text-center">
          <summary className="text-xs text-roots-gray cursor-pointer hover:text-roots-primary">
            Show full address
          </summary>
          <p className="mt-2 font-mono text-xs break-all bg-gray-50 p-2 rounded">
            {walletAddress}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
