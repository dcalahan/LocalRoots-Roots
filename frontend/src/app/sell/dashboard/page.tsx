'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useSellerListings, type SellerListing } from '@/hooks/useSellerListings';
import { useSellerOrders, OrderStatus, useAcceptOrder, useMarkReadyForPickup, useMarkOutForDelivery, useAutoClaimFunds, type SellerOrder } from '@/hooks/useSellerOrders';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import { ImageUploader } from '@/components/seller/ImageUploader';
import { EditListingModal } from '@/components/seller/EditListingModal';
import { EditSellerProfileModal } from '@/components/seller/EditSellerProfileModal';
import { useDeleteListing } from '@/hooks/useDeleteListing';
import { useToast } from '@/hooks/use-toast';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { formatDistance } from '@/lib/distance';
import { formatUnits } from 'viem';
import { uploadImage } from '@/lib/pinata';
import { rootsToFiat, formatFiat, formatRoots } from '@/lib/pricing';
import { SellerTierCard, SellerTierBadge } from '@/components/seeds/SellerTierBadge';
import { EarlyAdopterBanner } from '@/components/seeds/EarlyAdopterBanner';
import { getRewardLabel } from '@/components/seeds/PhaseConfig';
import { usePhase } from '@/hooks/usePhase';
import { ShareCardModal } from '@/components/ShareCardModal';
import type { ShareCardData } from '@/lib/shareCards';
import { GrowingProfileProvider } from '@/contexts/GrowingProfileContext';
import { GrowingProfileCard, MonthlyCalendar, TechniqueGuideCard } from '@/components/grow';
import guidesData from '@/data/technique-guides.json';
import { DISPUTE_WINDOW_SECONDS, formatTimeRemaining } from '@/types/order';

// Helper to convert base64 data URL to File
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

type Tab = 'listings' | 'orders' | 'history' | 'growing';

function formatPrice(priceWei: string): { fiat: string; roots: string } {
  const amount = BigInt(priceWei);
  return {
    fiat: formatFiat(rootsToFiat(amount)),
    roots: formatRoots(amount),
  };
}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending: return 'Pending Acceptance';
    case OrderStatus.Accepted: return 'Preparing';
    case OrderStatus.ReadyForPickup: return 'Ready for Pickup';
    case OrderStatus.OutForDelivery: return 'Delivered';
    case OrderStatus.Completed: return 'Completed';
    case OrderStatus.Disputed: return 'Disputed';
    case OrderStatus.Refunded: return 'Refunded';
    case OrderStatus.Cancelled: return 'Cancelled';
    default: return 'Unknown';
  }
}

function OrderActions({ order, onComplete }: { order: SellerOrder; onComplete: () => void }) {
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { acceptOrder, isPending: isAccepting, isSuccess: acceptSuccess, error: acceptError, reset: resetAccept } = useAcceptOrder();
  const { markReady, isPending: isMarkingReady, isSuccess: readySuccess, error: readyError, reset: resetReady } = useMarkReadyForPickup();
  const { markOutForDelivery, isPending: isMarkingDelivery, isSuccess: deliverySuccess, error: deliveryError, reset: resetDelivery } = useMarkOutForDelivery();

  // Log and display errors from hooks
  useEffect(() => {
    if (acceptError) {
      console.error('[OrderActions] Accept error from hook:', acceptError);
      const errorMessage = acceptError.message || 'Transaction failed';
      const isStaleData = errorMessage.includes('FailedCall') || errorMessage.includes('Invalid order status');
      toast({
        title: isStaleData ? 'Order already accepted' : 'Failed to accept order',
        description: isStaleData
          ? 'This order may have already been accepted. Refreshing...'
          : errorMessage,
        variant: 'destructive',
      });
      // If it's a stale data error, refresh the orders
      if (isStaleData) {
        resetAccept();
        onComplete();
      }
    }
  }, [acceptError, toast, resetAccept, onComplete]);

  useEffect(() => {
    if (readyError || deliveryError) {
      const err = readyError || deliveryError;
      console.error('[OrderActions] Ready/Delivery error from hook:', err);
      // Check for common errors and provide helpful messages
      const errorMessage = err?.message || 'Transaction failed';
      const isStaleData = errorMessage.includes('FailedCall') || errorMessage.includes('Invalid order status');
      toast({
        title: isStaleData ? 'Order already updated' : 'Failed to update order',
        description: isStaleData
          ? 'This order may have already been processed. Refreshing...'
          : errorMessage,
        variant: 'destructive',
      });
      // If it's a stale data error, refresh the orders
      if (isStaleData) {
        if (readyError) resetReady();
        if (deliveryError) resetDelivery();
        onComplete();
      }
    }
  }, [readyError, deliveryError, toast, resetReady, resetDelivery, onComplete]);

  useEffect(() => {
    console.log('[OrderActions] Success state changed:', { acceptSuccess, readySuccess, deliverySuccess });
    if (acceptSuccess || readySuccess || deliverySuccess) {
      console.log('[OrderActions] Success! Closing modal and refreshing...');
      setShowProofUpload(false);
      setProofImage(null);

      // Show success toast and reset state
      if (acceptSuccess) {
        toast({
          title: 'Order accepted!',
          description: 'You can now prepare the order.',
        });
        resetAccept();
      }
      if (readySuccess) {
        toast({
          title: 'Marked as ready!',
          description: 'The buyer has been notified. Funds will be released after the dispute window.',
        });
        resetReady();
      }
      if (deliverySuccess) {
        toast({
          title: 'Delivery confirmed!',
          description: 'Funds will be released after the 48-hour dispute window.',
        });
        resetDelivery();
      }

      // Refresh orders list with small delay to ensure blockchain state is updated
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  }, [acceptSuccess, readySuccess, deliverySuccess, onComplete, resetAccept, resetReady, resetDelivery, toast]);

  const handleAcceptOrder = async () => {
    console.log('[OrderActions] handleAcceptOrder called for order:', order.orderId);
    toast({
      title: 'Accepting order...',
      description: 'Please confirm in your wallet',
    });
    const success = await acceptOrder(BigInt(order.orderId));
    console.log('[OrderActions] acceptOrder returned:', success);
    if (success) {
      toast({
        title: 'Order accepted!',
        description: 'You can now prepare the order.',
      });
      setTimeout(() => onComplete(), 1000);
    }
  };

  const handleProofComplete = (imageData: string | null) => {
    setProofImage(imageData);
  };

  const handleSubmitProof = async () => {
    if (!proofImage) return;

    try {
      setIsUploading(true);

      // Upload image to IPFS if it's a base64 data URL
      let ipfsHash = proofImage;
      if (proofImage.startsWith('data:')) {
        toast({
          title: 'Uploading proof photo...',
          description: 'Saving to IPFS',
        });
        const imageFile = dataUrlToFile(proofImage, `proof-${order.orderId}-${Date.now()}.jpg`);
        const result = await uploadImage(imageFile);
        ipfsHash = result.ipfsHash;
        console.log('[OrderActions] Proof uploaded to IPFS:', ipfsHash);
      }

      toast({
        title: 'Submitting to blockchain...',
        description: 'Please confirm the transaction',
      });

      const orderId = BigInt(order.orderId);
      let success = false;
      if (order.isDelivery) {
        success = await markOutForDelivery(orderId, ipfsHash);
      } else {
        success = await markReady(orderId, ipfsHash);
      }

      if (success) {
        setShowProofUpload(false);
        setProofImage(null);
        toast({
          title: order.isDelivery ? 'Delivery confirmed!' : 'Marked as ready!',
          description: 'Funds will be released after the 48-hour dispute window.',
        });
        setTimeout(() => onComplete(), 1000);
      }
    } catch (err) {
      console.error('[OrderActions] Error:', err);
      toast({
        title: 'Failed to submit proof',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = isAccepting || isMarkingReady || isMarkingDelivery || isUploading;

  // Step 1: Pending orders need to be accepted first
  if (order.status === OrderStatus.Pending) {
    return (
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          className="bg-roots-primary hover:bg-roots-primary/90"
          onClick={handleAcceptOrder}
          disabled={isAccepting}
        >
          {isAccepting ? 'Accepting...' : 'Accept Order'}
        </Button>
      </div>
    );
  }

  // Step 2: Accepted orders can be marked ready/delivered with proof photo
  if (order.status === OrderStatus.Accepted) {
    if (showProofUpload) {
      return (
        <div className="mt-4 p-4 bg-white rounded-lg border space-y-4">
          <div>
            <h4 className="font-medium mb-2">Upload Proof Photo</h4>
            <p className="text-sm text-roots-gray mb-3">
              {order.isDelivery
                ? 'Take a photo showing the delivered order (e.g., at customer\'s door). This confirms delivery and releases payment to you.'
                : 'Take a photo of the order ready for pickup (e.g., items packaged and labeled). This releases payment to you.'
              }
            </p>
            <ImageUploader
              onUpload={handleProofComplete}
              currentHash={proofImage || undefined}
              label="Proof Photo"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowProofUpload(false);
                setProofImage(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-roots-secondary hover:bg-roots-secondary/90"
              onClick={handleSubmitProof}
              disabled={!proofImage || isPending}
            >
              {isPending ? (isUploading ? 'Uploading...' : 'Processing...') : order.isDelivery ? 'Confirm Delivered' : 'Mark Ready for Pickup'}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          className="bg-roots-secondary hover:bg-roots-secondary/90"
          onClick={() => setShowProofUpload(true)}
        >
          {order.isDelivery ? 'Confirm Delivery' : 'Mark Ready'}
        </Button>
      </div>
    );
  }

  if (order.status === OrderStatus.ReadyForPickup || order.status === OrderStatus.OutForDelivery) {
    // Calculate time until funds can be claimed
    const getFundsReleaseInfo = () => {
      if (order.fundsReleased) return { canClaim: false, text: 'Funds Released', color: 'text-green-600', icon: '✓' };
      if (!order.proofUploadedAt) return { canClaim: false, text: 'Awaiting Proof', color: 'text-roots-gray', icon: '⏳' };

      const now = Date.now();
      const releaseTime = order.proofUploadedAt.getTime() + (DISPUTE_WINDOW_SECONDS * 1000);
      const remaining = releaseTime - now;

      if (remaining <= 0) {
        return { canClaim: true, text: 'Ready to Claim Funds', color: 'text-green-600', icon: '💰' };
      }

      const remainingSeconds = Math.floor(remaining / 1000);
      return {
        canClaim: false,
        text: `Funds release in ${formatTimeRemaining(remainingSeconds)}`,
        color: 'text-amber-600',
        icon: '⏳'
      };
    };

    const releaseInfo = getFundsReleaseInfo();

    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
          <span className={`text-sm font-medium ${releaseInfo.color} flex items-center gap-1`}>
            {releaseInfo.icon} {releaseInfo.text}
          </span>
          {order.proofUploadedAt && !order.fundsReleased && (
            <span className="text-xs text-amber-700 block mt-1">
              Buyer can dispute until {new Date(order.proofUploadedAt.getTime() + DISPUTE_WINDOW_SECONDS * 1000).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Completed orders
  if (order.status === OrderStatus.Completed) {
    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="p-2 rounded-lg bg-green-50 border border-green-200">
          <span className="text-sm font-medium text-green-700 flex items-center gap-1">
            ✓ {order.fundsReleased ? 'Completed & Paid' : 'Completed - Funds Pending'}
          </span>
          {order.completedAt && (
            <span className="text-xs text-green-600 block mt-1">
              Completed on {order.completedAt.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Disputed orders
  if (order.status === OrderStatus.Disputed) {
    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="p-2 rounded-lg bg-red-50 border border-red-200">
          <span className="text-sm font-medium text-red-700 flex items-center gap-1">
            ⚠️ Disputed by Buyer
          </span>
          <span className="text-xs text-red-600 block mt-1">
            Funds are held until dispute is resolved. Contact support if needed.
          </span>
        </div>
      </div>
    );
  }

  // Refunded orders
  if (order.status === OrderStatus.Refunded) {
    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
            ↩️ Refunded to Buyer
          </span>
          <span className="text-xs text-gray-600 block mt-1">
            This order was refunded. No payment will be received.
          </span>
        </div>
      </div>
    );
  }

  // Cancelled orders
  if (order.status === OrderStatus.Cancelled) {
    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
            ✕ Cancelled
          </span>
          <span className="text-xs text-gray-600 block mt-1">
            This order was cancelled by admin.
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [editingListing, setEditingListing] = useState<SellerListing | null>(null);
  const [deletingListing, setDeletingListing] = useState<SellerListing | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [shareCardData, setShareCardData] = useState<ShareCardData | null>(null);
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const { isSeller, isLoading: isCheckingSeller } = useSellerStatus();
  const { profile, isLoading: isLoadingProfile, refetch: refetchProfile } = useSellerProfile();
  const { listings, isLoading: isLoadingListings, refetch: refetchListings } = useSellerListings();
  const { orders, isLoading: isLoadingOrders, refetch: refetchOrders } = useSellerOrders();
  const { deleteListing, isPending: isDeleting, isSuccess: deleteSuccess, error: deleteError, reset: resetDelete } = useDeleteListing();
  const { isPhase2 } = usePhase();
  const rewardLabel = getRewardLabel(isPhase2);

  // Auto-claim funds for orders past 48-hour dispute window
  const { isAutoClaiming } = useAutoClaimFunds(orders, refetchOrders);

  const distanceUnit = preferences.distanceUnit;

  // Handle delete success
  useEffect(() => {
    if (deleteSuccess) {
      toast({
        title: 'Listing deleted',
        description: 'The listing has been removed from the marketplace.',
      });
      setDeletingListing(null);
      resetDelete();
      refetchListings();
    }
  }, [deleteSuccess, toast, resetDelete, refetchListings]);

  // Handle delete error
  useEffect(() => {
    if (deleteError) {
      toast({
        title: 'Failed to delete listing',
        description: deleteError.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      setDeletingListing(null);
      resetDelete();
    }
  }, [deleteError, toast, resetDelete]);

  // Separate orders by status
  // Pending = new orders needing acceptance, Accepted = accepted and preparing
  const pendingOrders = orders.filter(o =>
    o.status === OrderStatus.Pending || o.status === OrderStatus.Accepted
  );
  // Active orders are Ready/OutForDelivery but funds NOT yet released
  const activeOrders = orders.filter(o =>
    (o.status === OrderStatus.ReadyForPickup || o.status === OrderStatus.OutForDelivery) &&
    !o.fundsReleased
  );
  // History includes completed, disputed, refunded, cancelled, OR any order with funds released
  const historyOrders = orders.filter(o =>
    o.status === OrderStatus.Completed ||
    o.status === OrderStatus.Disputed ||
    o.status === OrderStatus.Refunded ||
    o.status === OrderStatus.Cancelled ||
    o.fundsReleased
  );

  const activeListings = listings.filter(l => l.active);
  // Hide "deleted" listings (inactive with qty=0) from display
  const visibleListings = listings.filter(l => l.active || l.quantityAvailable > 0);
  console.log('[Dashboard] All listings:', listings.length, 'Visible listings:', visibleListings.length);
  console.log('[Dashboard] Listings details:', listings.map(l => ({ id: l.listingId, active: l.active, qty: l.quantityAvailable, name: l.metadata?.produceName })));
  const totalEarnings = historyOrders
    .filter(o => o.status === OrderStatus.Completed)
    .reduce((sum, o) => sum + parseFloat(formatUnits(BigInt(o.totalPrice), 18)), 0);

  if (isCheckingSeller) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <div className="text-roots-gray">Loading...</div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-heading text-3xl font-bold mb-4">Not Registered</h1>
          <p className="text-roots-gray mb-8">You need to register as a seller first.</p>
          <Link href="/sell/register">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Register as Seller
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate completed sales for tier
  const completedSales = historyOrders.filter(o => o.status === OrderStatus.Completed).length;

  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Early Adopter Banner - hidden in Phase 2 */}
      <EarlyAdopterBanner isPhase2={isPhase2} />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-roots-gray">Manage your garden store</p>
          </div>
          <Link href="/sell/listings/new">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              + Add Listing
            </Button>
          </Link>
        </div>

        {/* Profile Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Profile Image */}
              <div className="w-20 h-20 rounded-xl bg-roots-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.metadata?.imageUrl ? (
                  <img
                    src={profile.metadata.imageUrl}
                    alt={profile.metadata?.name || 'Profile'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-roots-primary">
                    {profile?.metadata?.name?.charAt(0).toUpperCase() || 'S'}
                  </span>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h2 className="font-heading text-xl font-bold">
                  {profile?.metadata?.name || 'Your Garden'}
                </h2>
                <p className="text-roots-gray text-sm mb-2">
                  {profile?.metadata?.description || 'Add a description to tell buyers about your garden.'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs items-center">
                  {/* Seller Tier Badge */}
                  <SellerTierBadge completedSales={completedSales} size="sm" />
                  {profile?.offersPickup && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      Pickup Available
                    </span>
                  )}
                  {profile?.offersDelivery && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      Delivery ({formatDistance(profile.deliveryRadiusKm, distanceUnit)})
                    </span>
                  )}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    Seller ID: {profile?.sellerId?.toString() || '...'}
                  </span>
                </div>
              </div>

              {/* Edit Button */}
              <Button
                variant="outline"
                onClick={() => setEditingProfile(true)}
                disabled={isLoadingProfile || !profile}
              >
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Modal */}
        {editingProfile && profile && (
          <EditSellerProfileModal
            profile={profile}
            onClose={() => setEditingProfile(false)}
            onSuccess={refetchProfile}
          />
        )}

        {/* Seller Tier Progress Card */}
        <SellerTierCard completedSales={completedSales} className="mb-8" />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Active Listings</p>
              <p className="text-2xl font-heading font-bold">
                {isLoadingListings ? '...' : activeListings.length}
              </p>
            </CardContent>
          </Card>
          <Card className={pendingOrders.length > 0 ? 'border-roots-secondary bg-roots-secondary/5' : ''}>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Pending Orders</p>
              <p className={`text-2xl font-heading font-bold ${pendingOrders.length > 0 ? 'text-roots-secondary' : ''}`}>
                {isLoadingOrders ? '...' : pendingOrders.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Completed Sales</p>
              <p className="text-2xl font-heading font-bold">
                {isLoadingOrders ? '...' : historyOrders.filter(o => o.status === OrderStatus.Completed).length}
              </p>
            </CardContent>
          </Card>
          <Link href="/sell/earnings">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-roots-primary/20 bg-roots-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Total Earnings</p>
                <p className="text-2xl font-heading font-bold text-roots-primary">
                  {isLoadingOrders ? '...' : (
                    <>
                      {formatFiat(rootsToFiat(BigInt(Math.floor(totalEarnings * 1e18))))}
                      <span className="block text-sm font-normal text-roots-gray">{formatRoots(BigInt(Math.floor(totalEarnings * 1e18)))} {rewardLabel}</span>
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/grow">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Growing Guides</p>
                <p className="text-2xl font-heading font-bold text-green-700">
                  What to Plant
                </p>
                <p className="text-xs text-green-600 mt-1">View calendar →</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('listings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'listings'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            My Listings
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'orders'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            Orders
            {pendingOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-roots-secondary text-white text-xs rounded-full flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('growing')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'growing'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            Growing
          </button>
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="pt-6">
            {activeTab === 'listings' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-heading text-xl font-bold">Your Listings</h2>
                  <Button variant="outline" size="sm" onClick={refetchListings}>
                    Refresh
                  </Button>
                </div>
                {isLoadingListings ? (
                  <div className="text-center py-12 text-roots-gray">Loading listings...</div>
                ) : visibleListings.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p className="mb-4">You haven&apos;t added any listings yet.</p>
                    <Link href="/sell/listings/new">
                      <Button className="bg-roots-primary">Add Your First Listing</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleListings.map((listing) => (
                      <div
                        key={listing.listingId}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          listing.active
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300'
                            : listing.quantityAvailable === 0
                              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                              : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shadow-sm ${
                            listing.metadata?.imageUrl ? '' : 'bg-roots-primary/10'
                          }`}>
                            {listing.metadata?.imageUrl ? (
                              <img
                                src={listing.metadata.imageUrl}
                                alt={listing.metadata.produceName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl">🥬</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{listing.metadata?.produceName || 'Unknown Product'}</p>
                            <p className="text-sm">
                              <span className="font-semibold text-roots-primary">{formatPrice(listing.pricePerUnit).fiat}</span>
                              <span className="text-roots-gray"> / {listing.metadata?.unit || 'unit'}</span>
                            </p>
                            <p className="text-xs text-roots-gray">{formatPrice(listing.pricePerUnit).roots} {rewardLabel}</p>
                            <p className={`text-xs ${listing.quantityAvailable > 5 ? 'text-green-600' : listing.quantityAvailable > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              {listing.quantityAvailable} available
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            listing.active
                              ? 'bg-green-100 text-green-700'
                              : listing.quantityAvailable === 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {listing.active ? '✓ Active' : listing.quantityAvailable === 0 ? 'Sold Out' : 'Inactive'}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-roots-secondary text-roots-secondary hover:bg-roots-secondary/5"
                            onClick={() => {
                              setShareCardData({
                                type: 'seller-listing',
                                produceName: listing.metadata?.produceName || 'Produce',
                                price: `${formatPrice(listing.pricePerUnit).fiat}/${listing.metadata?.unit || 'unit'}`,
                                sellerName: profile?.metadata?.name || '',
                                neighborhood: '',
                                imageUrl: listing.metadata?.imageUrl || undefined,
                              });
                            }}
                          >
                            Share
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-roots-primary text-roots-primary hover:bg-roots-primary/5"
                            onClick={() => setEditingListing(listing)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => setDeletingListing(listing)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit Listing Modal */}
                {editingListing && (
                  <EditListingModal
                    listing={editingListing}
                    onClose={() => setEditingListing(null)}
                    onSuccess={refetchListings}
                  />
                )}

                {/* Delete Confirmation Modal */}
                {deletingListing && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                      <h3 className="text-lg font-heading font-bold mb-2">Delete Listing?</h3>
                      <p className="text-roots-gray mb-4">
                        Are you sure you want to delete &quot;{deletingListing.metadata?.produceName || 'this listing'}&quot;?
                        This will remove it from the marketplace.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setDeletingListing(null)}
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          onClick={() => {
                            deleteListing({
                              listingId: BigInt(deletingListing.listingId),
                              metadataIpfs: deletingListing.metadataIpfs,
                              pricePerUnit: BigInt(deletingListing.pricePerUnit),
                            });
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'orders' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-heading text-xl font-bold">Current Orders</h2>
                  <Button variant="outline" size="sm" onClick={refetchOrders}>
                    Refresh
                  </Button>
                </div>
                {isLoadingOrders ? (
                  <div className="text-center py-12 text-roots-gray">Loading orders...</div>
                ) : pendingOrders.length === 0 && activeOrders.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p>No pending orders right now.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pending Orders */}
                    {pendingOrders.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-roots-gray uppercase">Needs Action</h3>
                        {pendingOrders.map((order) => (
                          <div
                            key={order.orderId}
                            className="p-4 rounded-lg border-2 border-roots-secondary bg-roots-secondary/5"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">Order #{order.orderId}</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {order.produceName || 'Unknown Product'} x{order.quantity}
                                </p>
                                <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                                  order.isDelivery
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {order.isDelivery ? '🚚 Delivery' : '📍 Pickup'}
                                </span>
                                <p className="text-xs text-roots-gray mt-1">
                                  Buyer: {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
                                </p>
                              </div>
                              <p className="font-bold text-roots-primary">{formatPrice(order.totalPrice).fiat}</p>
                              <p className="text-xs text-roots-gray">{formatPrice(order.totalPrice).roots} {rewardLabel}</p>
                            </div>
                            {/* Delivery address */}
                            {order.isDelivery && order.deliveryInfo && (
                              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs font-medium text-blue-800">Deliver to:</p>
                                <p className="text-sm text-blue-900">{order.deliveryInfo.address}</p>
                                {order.deliveryInfo.phone && (
                                  <p className="text-xs text-blue-700 mt-1">📞 {order.deliveryInfo.phone}</p>
                                )}
                                {order.deliveryInfo.notes && (
                                  <p className="text-xs text-blue-600 mt-1 italic">{order.deliveryInfo.notes}</p>
                                )}
                              </div>
                            )}
                            {order.isDelivery && !order.deliveryInfo && (
                              <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-xs text-amber-700">
                                  ⚠️ No delivery address provided. Contact buyer to arrange delivery.
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-roots-gray">
                                {order.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                            <OrderActions
                              order={order}
                              onComplete={refetchOrders}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active Orders (Ready/Out for Delivery) */}
                    {activeOrders.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-roots-gray uppercase">In Progress</h3>
                        {activeOrders.map((order) => (
                          <div
                            key={order.orderId}
                            className={`p-4 rounded-lg border-2 ${
                              order.status === OrderStatus.OutForDelivery
                                ? 'bg-gradient-to-r from-blue-50 to-sky-50 border-blue-200'
                                : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">Order #{order.orderId}</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {order.produceName || 'Unknown Product'} x{order.quantity}
                                </p>
                                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                                  order.isDelivery
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {order.isDelivery ? '🚚 Delivery' : '📍 Pickup'}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-roots-primary">{formatPrice(order.totalPrice).fiat}</p>
                              <p className="text-xs text-roots-gray">{formatPrice(order.totalPrice).roots} {rewardLabel}</p>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  order.status === OrderStatus.ReadyForPickup
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {getStatusLabel(order.status)}
                                </span>
                              </div>
                            </div>
                            {/* Delivery address */}
                            {order.isDelivery && order.deliveryInfo && (
                              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs font-medium text-blue-800">Deliver to:</p>
                                <p className="text-sm text-blue-900">{order.deliveryInfo.address}</p>
                                {order.deliveryInfo.phone && (
                                  <p className="text-xs text-blue-700 mt-1">📞 {order.deliveryInfo.phone}</p>
                                )}
                              </div>
                            )}
                            {order.fundsReleased && (
                              <p className="text-sm text-green-600 mt-2 font-medium">✓ Funds released to your wallet</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <>
                <h2 className="font-heading text-xl font-bold mb-4">Sales History</h2>
                {isLoadingOrders ? (
                  <div className="text-center py-12 text-roots-gray">Loading history...</div>
                ) : historyOrders.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p>No completed sales yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-roots-gray">Date</th>
                          <th className="pb-3 font-medium text-roots-gray">Order</th>
                          <th className="pb-3 font-medium text-roots-gray">Product</th>
                          <th className="pb-3 font-medium text-roots-gray">Buyer</th>
                          <th className="pb-3 font-medium text-roots-gray">Status</th>
                          <th className="pb-3 font-medium text-roots-gray text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyOrders.map((order) => (
                          <tr key={order.orderId} className="border-b last:border-0">
                            <td className="py-3 text-sm">
                              {order.completedAt?.toLocaleDateString() || order.createdAt.toLocaleDateString()}
                            </td>
                            <td className="py-3">#{order.orderId}</td>
                            <td className="py-3 text-sm">
                              {order.produceName || 'Unknown'} x{order.quantity}
                            </td>
                            <td className="py-3 text-roots-gray text-sm">
                              {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
                            </td>
                            <td className="py-3">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                order.status === OrderStatus.Completed
                                  ? 'bg-green-100 text-green-700'
                                  : order.status === OrderStatus.Refunded
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="font-medium">{formatPrice(order.totalPrice).fiat}</div>
                              <div className="text-xs text-roots-gray">{formatPrice(order.totalPrice).roots} {rewardLabel}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'growing' && (
              <GrowingProfileProvider>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="font-heading text-xl font-bold">Planting Calendar</h2>
                    <Link href="/grow" className="text-sm text-roots-primary hover:underline">
                      Full Growing Guides →
                    </Link>
                  </div>

                  {/* Growing Profile */}
                  <GrowingProfileCard />

                  {/* Monthly Calendar */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg">What to Plant Now</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MonthlyCalendar />
                    </CardContent>
                  </Card>

                  {/* Quick Guides */}
                  <div>
                    <h3 className="font-heading font-semibold mb-3">Quick Guides</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.values(guidesData.guides).slice(0, 4).map((guide) => (
                        <TechniqueGuideCard
                          key={guide.slug}
                          slug={guide.slug}
                          title={guide.title}
                          description={guide.description}
                          difficulty={guide.difficulty as 'beginner' | 'intermediate' | 'advanced'}
                          timeToComplete={guide.timeToComplete}
                          tags={guide.tags}
                          compact
                        />
                      ))}
                    </div>
                    <div className="text-center mt-4">
                      <Link
                        href="/grow/guides"
                        className="text-sm text-roots-primary hover:underline"
                      >
                        View All Guides →
                      </Link>
                    </div>
                  </div>
                </div>
              </GrowingProfileProvider>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Share Card Modal */}
      <ShareCardModal
        data={shareCardData}
        onClose={() => setShareCardData(null)}
      />
    </div>
  );
}
