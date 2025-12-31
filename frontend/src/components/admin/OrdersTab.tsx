'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminOrders, type OrderWithLocation } from '@/hooks/useAdminData';
import { useAdminActions } from '@/hooks/useAdminActions';
import { formatDistanceToNow } from 'date-fns';
import { formatUnits } from 'viem';

// Order status enum matching the contract
const ORDER_STATUS = {
  0: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  1: { label: 'Accepted', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'Ready/Out', color: 'bg-purple-100 text-purple-700' },
  3: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  4: { label: 'Disputed', color: 'bg-red-100 text-red-700' },
  5: { label: 'Refunded', color: 'bg-gray-100 text-gray-700' },
  6: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
} as const;

type StatusFilter = 'all' | 'active' | 'completed' | 'disputed' | 'cancelled';

export function OrdersTab() {
  const { orders, isLoading, refetch } = useAdminOrders();
  const { cancelOrder, isLoading: actionLoading } = useAdminActions();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cancelModal, setCancelModal] = useState<{ orderId: bigint } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredOrders = orders.filter((order) => {
    switch (statusFilter) {
      case 'active':
        return order.status >= 0 && order.status <= 2;
      case 'completed':
        return order.status === 3;
      case 'disputed':
        return order.status === 4;
      case 'cancelled':
        return order.status === 5 || order.status === 6;
      default:
        return true;
    }
  });

  const handleCancelOrder = async (orderId: bigint) => {
    if (!cancelReason.trim()) return;
    const success = await cancelOrder(orderId, cancelReason);
    if (success) {
      setCancelModal(null);
      setCancelReason('');
      refetch();
    }
  };

  const activeCount = orders.filter((o) => o.status >= 0 && o.status <= 2).length;
  const disputedCount = orders.filter((o) => o.status === 4).length;

  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-roots-gray">Total Orders</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">Active Orders</p>
          <p className="text-2xl font-bold text-blue-700">{activeCount}</p>
        </div>
        <div className={`rounded-lg p-4 ${disputedCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className={`text-sm ${disputedCount > 0 ? 'text-red-600' : 'text-roots-gray'}`}>Disputed</p>
          <p className={`text-2xl font-bold ${disputedCount > 0 ? 'text-red-700' : ''}`}>{disputedCount}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Completed</p>
          <p className="text-2xl font-bold text-green-700">
            {orders.filter((o) => o.status === 3).length}
          </p>
        </div>
      </div>

      {/* Filter & Refresh */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {(['all', 'active', 'completed', 'disputed', 'cancelled'] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                statusFilter === filter
                  ? 'bg-roots-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="text-center py-12 text-roots-gray">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-roots-gray">
          {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-roots-gray">
                <th className="pb-3 font-medium">Order ID</th>
                <th className="pb-3 font-medium">Buyer</th>
                <th className="pb-3 font-medium">Seller Location</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <OrderRow
                  key={order.id.toString()}
                  order={order}
                  onCancel={() => setCancelModal({ orderId: order.id })}
                  isLoading={actionLoading}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-heading text-xl font-bold mb-4">Cancel Order #{cancelModal.orderId.toString()}</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This will refund the buyer and claw back any pending ambassador rewards.
              </p>
            </div>
            <p className="text-roots-gray mb-4">
              Please provide a reason for cancelling this order.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation (e.g., suspected fraud, duplicate order)..."
              className="w-full p-3 border rounded-lg mb-4 h-24 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelModal(null);
                  setCancelReason('');
                }}
                disabled={actionLoading}
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleCancelOrder(cancelModal.orderId)}
                disabled={actionLoading || !cancelReason.trim()}
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Order & Refund'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  onCancel,
  isLoading,
}: {
  order: OrderWithLocation;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const status = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || { label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
  const totalPriceRoots = formatUnits(order.totalPrice, 18);
  const canCancel = order.status < 3; // Can only cancel if not completed/disputed/refunded

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-4 font-mono text-sm">#{order.id.toString()}</td>
      <td className="py-4">
        <a
          href={`https://sepolia.basescan.org/address/${order.buyer}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-roots-primary hover:underline font-mono text-sm"
        >
          {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)}
        </a>
      </td>
      <td className="py-4">
        <div className="text-sm">{order.sellerLocationName}</div>
        <div className="text-xs text-roots-gray">Seller #{order.sellerId.toString()}</div>
      </td>
      <td className="py-4">
        <div className="font-medium">{Number(totalPriceRoots).toLocaleString()} ROOTS</div>
        <div className="text-xs text-roots-gray">Qty: {order.quantity.toString()}</div>
      </td>
      <td className="py-4">
        <span className={`px-2 py-1 rounded text-xs ${order.isDelivery ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {order.isDelivery ? 'Delivery' : 'Pickup'}
        </span>
      </td>
      <td className="py-4">
        <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
        {order.fundsReleased && (
          <div className="text-xs text-green-600 mt-1">Funds Released</div>
        )}
      </td>
      <td className="py-4 text-sm text-roots-gray">
        {formatDistanceToNow(new Date(Number(order.createdAt) * 1000), { addSuffix: true })}
      </td>
      <td className="py-4">
        {canCancel ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        ) : (
          <span className="text-xs text-roots-gray">-</span>
        )}
      </td>
    </tr>
  );
}
