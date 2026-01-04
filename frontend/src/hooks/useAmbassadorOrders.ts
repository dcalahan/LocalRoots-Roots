'use client';

import { useQuery } from '@tanstack/react-query';

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

export interface RecruitedSellerOrder {
  id: string;
  buyer: string;
  quantity: string;
  totalPrice: string;
  isDelivery: boolean;
  status: string;
  createdAt: string;
  completedAt: string | null;
  seller: {
    id: string;
    storefrontIpfs: string;
  };
  listing: {
    id: string;
    metadataIpfs: string;
  };
}

export interface RecruitedSeller {
  id: string;
  owner: string;
  storefrontIpfs: string;
  totalSales: string;
  totalOrders: string;
  active: boolean;
  orders: RecruitedSellerOrder[];
}

// Fetch all orders from sellers recruited by an ambassador
export function useAmbassadorOrders(ambassadorId: string | undefined) {
  return useQuery({
    queryKey: ['ambassadorOrders', ambassadorId],
    enabled: !!ambassadorId && !!SUBGRAPH_URL,
    queryFn: async () => {
      if (!SUBGRAPH_URL || !ambassadorId) return { sellers: [], orders: [] };

      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            ambassador(id: "${ambassadorId}") {
              id
              wallet
              recruitedSellersCount
              recruitedSellers(first: 100) {
                id
                owner
                storefrontIpfs
                totalSales
                totalOrders
                active
                orders(first: 50, orderBy: createdAt, orderDirection: desc) {
                  id
                  buyer
                  quantity
                  totalPrice
                  isDelivery
                  status
                  createdAt
                  completedAt
                  listing {
                    id
                    metadataIpfs
                  }
                }
              }
            }
          }`
        })
      });
      const { data, errors } = await res.json();

      if (errors) {
        console.error('[useAmbassadorOrders] GraphQL errors:', errors);
        return { sellers: [], orders: [] };
      }

      if (!data?.ambassador) {
        return { sellers: [], orders: [] };
      }

      const sellers = data.ambassador.recruitedSellers as RecruitedSeller[];

      // Flatten all orders from all sellers with seller info attached
      const allOrders: (RecruitedSellerOrder & { sellerInfo: { id: string; storefrontIpfs: string } })[] = [];

      for (const seller of sellers) {
        for (const order of seller.orders) {
          allOrders.push({
            ...order,
            seller: { id: seller.id, storefrontIpfs: seller.storefrontIpfs },
            sellerInfo: { id: seller.id, storefrontIpfs: seller.storefrontIpfs }
          });
        }
      }

      // Sort by createdAt descending
      allOrders.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));

      return { sellers, orders: allOrders };
    },
    staleTime: 30000, // 30 seconds
  });
}

// Calculate potential commission for an order (25% of order value)
export function calculateCommission(totalPrice: string): bigint {
  const price = BigInt(totalPrice);
  return (price * 25n) / 100n; // 25% commission
}

// Format order status for display
export function formatOrderStatus(status: string): { label: string; color: string } {
  switch (status) {
    case 'Pending':
      return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    case 'Accepted':
      return { label: 'Preparing', color: 'bg-blue-100 text-blue-800' };
    case 'ReadyForPickup':
      return { label: 'Ready', color: 'bg-purple-100 text-purple-800' };
    case 'OutForDelivery':
      return { label: 'Delivered', color: 'bg-indigo-100 text-indigo-800' };
    case 'Completed':
      return { label: 'Completed', color: 'bg-green-100 text-green-800' };
    case 'Disputed':
      return { label: 'Disputed', color: 'bg-red-100 text-red-800' };
    case 'Refunded':
      return { label: 'Refunded', color: 'bg-gray-100 text-gray-800' };
    case 'Cancelled':
      return { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' };
    default:
      return { label: status, color: 'bg-gray-100 text-gray-800' };
  }
}
