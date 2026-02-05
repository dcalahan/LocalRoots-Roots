'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  generateCard,
  shareCard,
  downloadImage,
  copyToClipboard,
  getSmsShareUrl,
  getFacebookShareUrl,
  getEmailShareUrl,
  getNextDoorShareUrl,
  getCardShareUrl,
  getShareText,
  getEmailSubject,
  supportsNextDoor,
  type ShareCardData,
} from '@/lib/shareCards';
import {
  decodeGeohash,
  reverseGeocodeWithNeighborhood,
  formatNeighborhoodDisplay,
} from '@/lib/geohashLocation';

interface ShareCardModalProps {
  data: ShareCardData | null;
  onClose: () => void;
  /** Seller geohash hex for neighborhood resolution (Cards 3 & 4) */
  sellerGeohash?: string;
}

export function ShareCardModal({ data, onClose, sellerGeohash }: ShareCardModalProps) {
  const { toast } = useToast();
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Resolve neighborhood and generate card
  const generateCardImage = useCallback(async () => {
    if (!data) return;

    setIsGenerating(true);
    setCardImage(null);

    let cardData = { ...data };

    // Resolve neighborhood for listing cards
    if (sellerGeohash && (data.type === 'seller-listing' || data.type === 'ambassador-listing')) {
      try {
        const { latitude, longitude } = decodeGeohash(sellerGeohash);
        const result = await reverseGeocodeWithNeighborhood(latitude, longitude);
        const neighborhood = formatNeighborhoodDisplay(result);
        if (data.type === 'seller-listing') {
          cardData = { ...data, neighborhood: neighborhood || data.neighborhood };
        } else {
          cardData = { ...data, neighborhood: neighborhood || data.neighborhood };
        }
      } catch (err) {
        console.error('[ShareCardModal] Neighborhood resolution failed:', err);
      }
    }

    try {
      const imageDataUrl = await generateCard(cardData);
      setCardImage(imageDataUrl);
    } catch (err) {
      console.error('[ShareCardModal] Card generation failed:', err);
      toast({
        title: 'Failed to generate card',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [data, sellerGeohash, toast]);

  useEffect(() => {
    if (data) {
      generateCardImage();
    }
  }, [data, generateCardImage]);

  if (!data) return null;

  const shareUrl = getCardShareUrl(data);
  const showNextDoor = supportsNextDoor(data);

  const handleShare = async () => {
    if (!cardImage) return;
    const text = getShareText(data, 'generic');
    await shareCard(cardImage, text, shareUrl);
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSms = () => {
    const text = getShareText(data, 'sms');
    window.open(getSmsShareUrl(text), '_blank');
  };

  const handleFacebook = () => {
    window.open(getFacebookShareUrl(shareUrl), '_blank', 'width=600,height=400');
  };

  const handleEmail = () => {
    const subject = getEmailSubject(data);
    const body = getShareText(data, 'email');
    window.location.href = getEmailShareUrl(subject, body);
  };

  const handleNextDoor = async () => {
    const text = getShareText(data, 'nextdoor');
    await copyToClipboard(text);
    window.open(getNextDoorShareUrl(), '_blank');
    toast({
      title: 'Text copied!',
      description: 'Paste it into your NextDoor post.',
    });
  };

  const handleDownload = () => {
    if (!cardImage) return;
    const filename = `localroots-${data.type}-${Date.now()}.png`;
    downloadImage(cardImage, filename);
    toast({ title: 'Image downloaded!' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-heading font-bold text-lg">Share</h3>
          <button
            onClick={onClose}
            className="text-roots-gray hover:text-gray-900 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-4">
          {isGenerating ? (
            <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-roots-gray">Generating card...</p>
              </div>
            </div>
          ) : cardImage ? (
            <img
              src={cardImage}
              alt="Share card preview"
              className="w-full rounded-lg shadow-sm"
            />
          ) : (
            <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-sm text-roots-gray">Failed to generate card</p>
            </div>
          )}
        </div>

        {/* Share Buttons */}
        <div className="px-4 pb-4 space-y-3">
          {/* Primary share (native) */}
          <Button
            onClick={handleShare}
            disabled={!cardImage}
            className="w-full bg-roots-primary hover:bg-roots-primary/90 text-white"
          >
            Share
          </Button>

          {/* Channel grid */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{copiedLink ? '\u2705' : '\u{1F517}'}</span>
              <span className="text-xs text-roots-gray">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleSms}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{'\u{1F4AC}'}</span>
              <span className="text-xs text-roots-gray">SMS</span>
            </button>

            <button
              onClick={handleFacebook}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{'\u{1F310}'}</span>
              <span className="text-xs text-roots-gray">Facebook</span>
            </button>

            <button
              onClick={handleEmail}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{'\u2709\uFE0F'}</span>
              <span className="text-xs text-roots-gray">Email</span>
            </button>

            {showNextDoor && (
              <button
                onClick={handleNextDoor}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">{'\u{1F3E0}'}</span>
                <span className="text-xs text-roots-gray">NextDoor</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={!cardImage}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <span className="text-xl">{'\u2B07\uFE0F'}</span>
              <span className="text-xs text-roots-gray">Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
