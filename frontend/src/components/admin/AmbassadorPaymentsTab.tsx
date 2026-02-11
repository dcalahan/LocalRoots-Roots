'use client';

/**
 * AmbassadorPaymentsTab - Admin tab to view and manage ambassador payments
 * TEMPORARY - This entire component will be removed when $ROOTS token launches
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { formatCentsToUsd } from '@/hooks/useAmbassadorPayments';
import { MarkPaidModal } from './MarkPaidModal';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi, type Ambassador, type PaymentSummary, type AmbassadorProfile } from '@/lib/contracts/ambassador';
import { getIpfsUrl } from '@/lib/pinata';

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

interface AmbassadorWithPayments {
  id: string;
  wallet: string;
  profileIpfs: string;
  profile: AmbassadorProfile | null;
  totalEarned: number;  // cents - from subgraph orders
  totalPaid: number;    // cents - from KV
  balanceOwed: number;  // cents
  paymentMethod?: string;
  paymentHandle?: string;
  lastPaidAt?: number;
}

export function AmbassadorPaymentsTab() {
  const { address: adminAddress } = useAdminStatus();
  const [selectedAmbassadors, setSelectedAmbassadors] = useState<Set<string>>(new Set());
  const [markPaidAmbassador, setMarkPaidAmbassador] = useState<AmbassadorWithPayments | null>(null);

  // Fetch all ambassadors from contract
  const { data: ambassadors, isLoading: isLoadingAmbassadors, refetch } = useQuery({
    queryKey: ['allAmbassadors'],
    queryFn: async (): Promise<AmbassadorWithPayments[]> => {
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Get next ambassador ID to know how many ambassadors exist
      const nextId = await client.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'nextAmbassadorId',
      }) as bigint;

      const ambassadorList: AmbassadorWithPayments[] = [];

      // Fetch each ambassador (ID starts at 1)
      for (let i = 1n; i < nextId; i++) {
        try {
          const data = await client.readContract({
            address: AMBASSADOR_REWARDS_ADDRESS,
            abi: ambassadorAbi,
            functionName: 'getAmbassador',
            args: [i],
          }) as any;

          // Skip if not active or suspended
          if (!data.active || data.suspended) continue;

          // Fetch profile from IPFS if available
          let profile: AmbassadorProfile | null = null;
          if (data.profileIpfs) {
            try {
              const url = getIpfsUrl(data.profileIpfs);
              const res = await fetch(url);
              if (res.ok) {
                profile = await res.json();
              }
            } catch (err) {
              console.warn(`[AmbassadorPaymentsTab] Failed to fetch profile for ${i}:`, err);
            }
          }

          ambassadorList.push({
            id: i.toString(),
            wallet: data.wallet,
            profileIpfs: data.profileIpfs,
            profile,
            totalEarned: 0, // Will be populated from subgraph
            totalPaid: 0,   // Will be populated from KV
            balanceOwed: 0,
            paymentMethod: profile?.paymentMethod,
            paymentHandle: profile?.paymentHandle,
          });
        } catch (err) {
          console.error(`[AmbassadorPaymentsTab] Error fetching ambassador ${i}:`, err);
        }
      }

      return ambassadorList;
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch earnings from subgraph for all ambassadors
  const { data: earningsData, isLoading: isLoadingEarnings } = useQuery({
    queryKey: ['ambassadorEarnings', ambassadors?.map(a => a.id)],
    enabled: !!ambassadors && ambassadors.length > 0 && !!SUBGRAPH_URL,
    queryFn: async () => {
      const earnings: Record<string, number> = {};

      for (const ambassador of ambassadors || []) {
        try {
          const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `{
                ambassador(id: "${ambassador.id}") {
                  recruitedSellers(first: 100) {
                    orders(first: 100) {
                      totalPrice
                      status
                    }
                  }
                }
              }`
            })
          });

          const { data } = await res.json();

          if (data?.ambassador?.recruitedSellers) {
            let total = 0;
            for (const seller of data.ambassador.recruitedSellers) {
              for (const order of seller.orders || []) {
                if (order.status === 'Completed') {
                  // Convert ROOTS (18 decimals) to USD cents with 25% commission
                  const priceInUsd = Number(order.totalPrice) / 1e18 / 100;
                  const commissionUsd = priceInUsd * 0.25;
                  total += Math.round(commissionUsd * 100);
                }
              }
            }
            earnings[ambassador.id] = total;
          }
        } catch (err) {
          console.error(`[AmbassadorPaymentsTab] Error fetching earnings for ${ambassador.id}:`, err);
        }
      }

      return earnings;
    },
  });

  // Fetch payment summaries from KV
  const { data: paymentSummaries, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['allPaymentSummaries', adminAddress],
    enabled: !!adminAddress,
    queryFn: async (): Promise<Record<string, PaymentSummary>> => {
      if (!adminAddress) return {};

      const res = await fetch(`/api/payments?adminAddress=${adminAddress}`);
      if (!res.ok) return {};

      const { summaries } = await res.json();
      const byId: Record<string, PaymentSummary> = {};
      for (const s of summaries || []) {
        byId[s.ambassadorId] = s;
      }
      return byId;
    },
  });

  // Combine all data
  const enrichedAmbassadors: AmbassadorWithPayments[] = (ambassadors || []).map(amb => {
    const earned = earningsData?.[amb.id] || 0;
    const paid = paymentSummaries?.[amb.id]?.totalPaid || 0;
    return {
      ...amb,
      totalEarned: earned,
      totalPaid: paid,
      balanceOwed: Math.max(0, earned - paid),
      lastPaidAt: paymentSummaries?.[amb.id]?.lastPaidAt,
    };
  }).sort((a, b) => b.balanceOwed - a.balanceOwed); // Sort by balance owed descending

  const isLoading = isLoadingAmbassadors || isLoadingEarnings || isLoadingPayments;

  const toggleSelection = (id: string) => {
    const next = new Set(selectedAmbassadors);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedAmbassadors(next);
  };

  const selectedTotal = enrichedAmbassadors
    .filter(a => selectedAmbassadors.has(a.id))
    .reduce((sum, a) => sum + a.balanceOwed, 0);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-roots-gray">
        Loading ambassador payment data...
      </div>
    );
  }

  if (enrichedAmbassadors.length === 0) {
    return (
      <div className="py-8 text-center text-roots-gray">
        No ambassadors registered yet.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Ambassador Payments</h2>
          <p className="text-sm text-roots-gray">
            Track and record cash payments to ambassadors
          </p>
        </div>
        <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
          TEMPORARY - until $ROOTS launch
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCentsToUsd(enrichedAmbassadors.reduce((s, a) => s + a.totalEarned, 0))}
            </div>
            <div className="text-sm text-roots-gray">Total Earned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCentsToUsd(enrichedAmbassadors.reduce((s, a) => s + a.totalPaid, 0))}
            </div>
            <div className="text-sm text-roots-gray">Total Paid</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {formatCentsToUsd(enrichedAmbassadors.reduce((s, a) => s + a.balanceOwed, 0))}
            </div>
            <div className="text-sm text-roots-gray">Total Owed</div>
          </CardContent>
        </Card>
      </div>

      {/* Ambassador List */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10 p-3"></th>
              <th className="text-left p-3 font-medium">Ambassador</th>
              <th className="text-left p-3 font-medium">Payment Method</th>
              <th className="text-right p-3 font-medium">Earned</th>
              <th className="text-right p-3 font-medium">Paid</th>
              <th className="text-right p-3 font-medium">Owed</th>
              <th className="text-right p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {enrichedAmbassadors.map((amb) => (
              <tr
                key={amb.id}
                className={`border-b hover:bg-gray-50 ${
                  amb.balanceOwed > 5000 ? 'bg-roots-primary/5' : ''
                }`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedAmbassadors.has(amb.id)}
                    onChange={() => toggleSelection(amb.id)}
                    disabled={amb.balanceOwed === 0}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium">
                    {amb.profile?.name || `Ambassador #${amb.id}`}
                  </div>
                  <div className="text-xs text-roots-gray">
                    {amb.wallet.slice(0, 8)}...{amb.wallet.slice(-4)}
                  </div>
                </td>
                <td className="p-3">
                  {amb.paymentMethod && amb.paymentHandle ? (
                    <span className="text-sm">
                      {amb.paymentMethod === 'venmo' && '💳 '}
                      {amb.paymentMethod === 'paypal' && '💸 '}
                      {amb.paymentMethod === 'zelle' && '🏦 '}
                      {amb.paymentHandle}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600">
                      ⚠️ Not set
                    </span>
                  )}
                </td>
                <td className="p-3 text-right font-medium text-green-600">
                  {formatCentsToUsd(amb.totalEarned)}
                </td>
                <td className="p-3 text-right text-blue-600">
                  {formatCentsToUsd(amb.totalPaid)}
                </td>
                <td className={`p-3 text-right font-bold ${
                  amb.balanceOwed > 5000 ? 'text-roots-primary' :
                  amb.balanceOwed > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}>
                  {formatCentsToUsd(amb.balanceOwed)}
                </td>
                <td className="p-3 text-right">
                  {amb.balanceOwed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMarkPaidAmbassador(amb)}
                    >
                      Mark Paid
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selection Summary */}
      {selectedAmbassadors.size > 0 && (
        <div className="mt-4 p-4 bg-roots-primary/10 rounded-lg flex items-center justify-between">
          <div>
            <span className="font-medium">
              {selectedAmbassadors.size} ambassador{selectedAmbassadors.size !== 1 ? 's' : ''} selected
            </span>
            <span className="text-roots-gray ml-2">
              Total to pay: <strong className="text-roots-primary">{formatCentsToUsd(selectedTotal)}</strong>
            </span>
          </div>
          <Button
            onClick={() => {
              // For now, just show toast - could batch mark paid in future
              alert(`Selected: ${Array.from(selectedAmbassadors).join(', ')}\nTotal: ${formatCentsToUsd(selectedTotal)}`);
            }}
            className="bg-roots-primary hover:bg-roots-primary/90"
          >
            Mark All Paid
          </Button>
        </div>
      )}

      {/* Mark Paid Modal */}
      {markPaidAmbassador && adminAddress && (
        <MarkPaidModal
          isOpen={!!markPaidAmbassador}
          onClose={() => setMarkPaidAmbassador(null)}
          ambassador={markPaidAmbassador}
          adminAddress={adminAddress}
          onSuccess={() => {
            setMarkPaidAmbassador(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
