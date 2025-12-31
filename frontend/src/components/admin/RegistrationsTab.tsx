'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminSellers, useAdminAmbassadors, type SellerWithLocation, type AmbassadorWithLocation } from '@/hooks/useAdminData';
import { useAdminActions } from '@/hooks/useAdminActions';
import { formatDistanceToNow } from 'date-fns';

type RegistrationType = 'sellers' | 'ambassadors';

export function RegistrationsTab() {
  const [viewType, setViewType] = useState<RegistrationType>('sellers');
  const { sellers, isLoading: loadingSellers, refetch: refetchSellers } = useAdminSellers();
  const { ambassadors, isLoading: loadingAmbassadors, refetch: refetchAmbassadors } = useAdminAmbassadors();
  const { suspendSeller, unsuspendSeller, suspendAmbassador, isLoading: actionLoading } = useAdminActions();

  const [suspendModal, setSuspendModal] = useState<{
    type: 'seller' | 'ambassador';
    id: bigint;
    name: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const handleSuspendSeller = async (sellerId: bigint) => {
    if (!suspendReason.trim()) return;
    const success = await suspendSeller(sellerId, suspendReason);
    if (success) {
      setSuspendModal(null);
      setSuspendReason('');
      refetchSellers();
    }
  };

  const handleUnsuspendSeller = async (sellerId: bigint) => {
    const success = await unsuspendSeller(sellerId);
    if (success) {
      refetchSellers();
    }
  };

  const handleSuspendAmbassador = async (ambassadorId: bigint) => {
    if (!suspendReason.trim()) return;
    const success = await suspendAmbassador(ambassadorId, suspendReason);
    if (success) {
      setSuspendModal(null);
      setSuspendReason('');
      refetchAmbassadors();
    }
  };

  const isLoading = loadingSellers || loadingAmbassadors;

  return (
    <div>
      {/* View Toggle */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('sellers')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'sellers'
                ? 'bg-roots-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sellers ({sellers.length})
          </button>
          <button
            onClick={() => setViewType('ambassadors')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'ambassadors'
                ? 'bg-roots-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ambassadors ({ambassadors.length})
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => viewType === 'sellers' ? refetchSellers() : refetchAmbassadors()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Sellers List */}
      {viewType === 'sellers' && (
        <div>
          {loadingSellers ? (
            <div className="text-center py-12 text-roots-gray">Loading sellers...</div>
          ) : sellers.length === 0 ? (
            <div className="text-center py-12 text-roots-gray">No registered sellers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-roots-gray">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Owner</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium">Services</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Registered</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((seller) => (
                    <SellerRow
                      key={seller.id.toString()}
                      seller={seller}
                      onSuspend={() => setSuspendModal({ type: 'seller', id: seller.id, name: `Seller #${seller.id}` })}
                      onUnsuspend={() => handleUnsuspendSeller(seller.id)}
                      isLoading={actionLoading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ambassadors List */}
      {viewType === 'ambassadors' && (
        <div>
          {loadingAmbassadors ? (
            <div className="text-center py-12 text-roots-gray">Loading ambassadors...</div>
          ) : ambassadors.length === 0 ? (
            <div className="text-center py-12 text-roots-gray">No registered ambassadors yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-roots-gray">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Wallet</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium">Recruited</th>
                    <th className="pb-3 font-medium">Earnings</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Registered</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ambassadors.map((ambassador) => (
                    <AmbassadorRow
                      key={ambassador.id.toString()}
                      ambassador={ambassador}
                      onSuspend={() => setSuspendModal({ type: 'ambassador', id: ambassador.id, name: `Ambassador #${ambassador.id}` })}
                      isLoading={actionLoading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-heading text-xl font-bold mb-4">Suspend {suspendModal.name}</h3>
            <p className="text-roots-gray mb-4">
              Please provide a reason for suspending this {suspendModal.type}. This action can be reversed.
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter reason for suspension..."
              className="w-full p-3 border rounded-lg mb-4 h-24 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSuspendModal(null);
                  setSuspendReason('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (suspendModal.type === 'seller') {
                    handleSuspendSeller(suspendModal.id);
                  } else {
                    handleSuspendAmbassador(suspendModal.id);
                  }
                }}
                disabled={actionLoading || !suspendReason.trim()}
              >
                {actionLoading ? 'Suspending...' : 'Suspend'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SellerRow({
  seller,
  onSuspend,
  onUnsuspend,
  isLoading,
}: {
  seller: SellerWithLocation;
  onSuspend: () => void;
  onUnsuspend: () => void;
  isLoading: boolean;
}) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-4 font-mono text-sm">#{seller.id.toString()}</td>
      <td className="py-4">
        <a
          href={`https://sepolia.basescan.org/address/${seller.owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-roots-primary hover:underline font-mono text-sm"
        >
          {seller.owner.slice(0, 6)}...{seller.owner.slice(-4)}
        </a>
      </td>
      <td className="py-4">
        <div className="text-sm">{seller.locationName}</div>
        <div className="text-xs text-roots-gray">{seller.location.geohashString}</div>
      </td>
      <td className="py-4">
        <div className="flex gap-2">
          {seller.offersDelivery && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Delivery</span>
          )}
          {seller.offersPickup && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Pickup</span>
          )}
        </div>
      </td>
      <td className="py-4">
        {seller.suspended ? (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Suspended</span>
        ) : seller.active ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
        ) : (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Inactive</span>
        )}
      </td>
      <td className="py-4 text-sm text-roots-gray">
        {formatDistanceToNow(new Date(Number(seller.createdAt) * 1000), { addSuffix: true })}
      </td>
      <td className="py-4">
        {seller.suspended ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnsuspend}
            disabled={isLoading}
          >
            Unsuspend
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={onSuspend}
            disabled={isLoading}
          >
            Suspend
          </Button>
        )}
      </td>
    </tr>
  );
}

function AmbassadorRow({
  ambassador,
  onSuspend,
  isLoading,
}: {
  ambassador: AmbassadorWithLocation;
  onSuspend: () => void;
  isLoading: boolean;
}) {
  const totalEarnedRoots = Number(ambassador.totalEarned) / 1e18;

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-4 font-mono text-sm">#{ambassador.id.toString()}</td>
      <td className="py-4">
        <a
          href={`https://sepolia.basescan.org/address/${ambassador.wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-roots-primary hover:underline font-mono text-sm"
        >
          {ambassador.wallet.slice(0, 6)}...{ambassador.wallet.slice(-4)}
        </a>
      </td>
      <td className="py-4">
        <div className="text-sm">{ambassador.locationName}</div>
        <div className="text-xs text-roots-gray">{ambassador.location.geohashString}</div>
      </td>
      <td className="py-4">
        <div className="text-sm">
          {ambassador.recruitedSellers.toString()} sellers, {ambassador.recruitedAmbassadors.toString()} ambassadors
        </div>
      </td>
      <td className="py-4">
        <div className="text-sm font-medium">{totalEarnedRoots.toLocaleString()} ROOTS</div>
      </td>
      <td className="py-4">
        {ambassador.suspended ? (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Suspended</span>
        ) : ambassador.active ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
        ) : (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Inactive</span>
        )}
      </td>
      <td className="py-4 text-sm text-roots-gray">
        {formatDistanceToNow(new Date(Number(ambassador.createdAt) * 1000), { addSuffix: true })}
      </td>
      <td className="py-4">
        {!ambassador.suspended && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onSuspend}
            disabled={isLoading || ambassador.suspended}
          >
            Suspend
          </Button>
        )}
        {ambassador.suspended && (
          <span className="text-xs text-roots-gray">Contact owner</span>
        )}
      </td>
    </tr>
  );
}
