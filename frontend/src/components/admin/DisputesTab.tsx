'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { publicClient } from '@/lib/viemClient';
import { DISPUTE_RESOLUTION_ADDRESS, disputeResolutionAbi, type Dispute } from '@/lib/contracts/disputeResolution';
import { useGaslessTransaction } from '@/hooks/useGaslessTransaction';

export function DisputesTab() {
  const [disputes, setDisputes] = useState<(Dispute & { id: bigint })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState<{ id: bigint; orderId: bigint } | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [buyerWins, setBuyerWins] = useState(true);
  const { executeGasless, isLoading: actionLoading } = useGaslessTransaction();

  const fetchDisputes = async () => {
    setIsLoading(true);
    try {
      // Get total dispute count
      const nextId = await publicClient.readContract({
        address: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'nextDisputeId',
      }) as bigint;

      const disputeList: (Dispute & { id: bigint })[] = [];

      // Fetch all disputes (1 to nextId - 1)
      for (let i = 1n; i < nextId; i++) {
        try {
          const dispute = await publicClient.readContract({
            address: DISPUTE_RESOLUTION_ADDRESS,
            abi: disputeResolutionAbi,
            functionName: 'getDispute',
            args: [i],
          }) as Dispute;

          disputeList.push({ ...dispute, id: i });
        } catch (e) {
          console.error(`Failed to fetch dispute ${i}:`, e);
        }
      }

      // Sort by createdAt descending (newest first)
      disputeList.sort((a, b) => Number(b.createdAt - a.createdAt));
      setDisputes(disputeList);
    } catch (error) {
      console.error('Failed to fetch disputes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleAdminResolve = async () => {
    if (!resolveModal || !resolveReason.trim()) return;

    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'adminResolveDispute',
        args: [resolveModal.id, buyerWins, resolveReason],
      });

      if (txHash) {
        setResolveModal(null);
        setResolveReason('');
        setBuyerWins(true);
        fetchDisputes();
      }
    } catch (error) {
      console.error('Failed to resolve dispute:', error);
    }
  };

  const openDisputes = disputes.filter(d => !d.resolved);
  const resolvedDisputes = disputes.filter(d => d.resolved);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-heading text-xl font-bold">Disputes</h2>
          <p className="text-roots-gray text-sm">
            {openDisputes.length} open, {resolvedDisputes.length} resolved
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDisputes} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-roots-gray">Loading disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 text-roots-gray">No disputes found</div>
      ) : (
        <div className="space-y-4">
          {/* Open Disputes */}
          {openDisputes.length > 0 && (
            <div>
              <h3 className="font-medium text-lg mb-3">Open Disputes</h3>
              <div className="space-y-3">
                {openDisputes.map((dispute) => (
                  <DisputeCard
                    key={dispute.id.toString()}
                    dispute={dispute}
                    onResolve={() => setResolveModal({ id: dispute.id, orderId: dispute.orderId })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved Disputes */}
          {resolvedDisputes.length > 0 && (
            <div className="mt-8">
              <h3 className="font-medium text-lg mb-3 text-roots-gray">Resolved Disputes</h3>
              <div className="space-y-3 opacity-75">
                {resolvedDisputes.map((dispute) => (
                  <DisputeCard
                    key={dispute.id.toString()}
                    dispute={dispute}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-heading text-xl font-bold mb-4">
              Resolve Dispute #{resolveModal.id.toString()}
            </h3>
            <p className="text-roots-gray mb-4">
              Admin resolution bypasses voting. Use sparingly and provide a clear reason.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Decision</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setBuyerWins(true)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    buyerWins
                      ? 'border-roots-primary bg-roots-primary/10 text-roots-primary'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Buyer Wins
                  <div className="text-xs mt-1 text-roots-gray">Refund buyer</div>
                </button>
                <button
                  onClick={() => setBuyerWins(false)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                    !buyerWins
                      ? 'border-roots-secondary bg-roots-secondary/10 text-roots-secondary'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Seller Wins
                  <div className="text-xs mt-1 text-roots-gray">Release funds</div>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Reason (required)</label>
              <textarea
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                placeholder="Explain your decision..."
                className="w-full p-3 border rounded-lg h-24 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setResolveModal(null);
                  setResolveReason('');
                  setBuyerWins(true);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdminResolve}
                disabled={actionLoading || !resolveReason.trim()}
              >
                {actionLoading ? 'Resolving...' : 'Resolve Dispute'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DisputeCard({
  dispute,
  onResolve,
}: {
  dispute: Dispute & { id: bigint };
  onResolve?: () => void;
}) {
  const isOpen = !dispute.resolved;
  const votingEnded = BigInt(Date.now()) / 1000n > dispute.votingEndsAt;
  const totalVotes = Number(dispute.votesForBuyer + dispute.votesForSeller);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              Dispute #{dispute.id.toString()}
            </span>
            <span className="text-roots-gray">→</span>
            <span className="font-mono text-sm">Order #{dispute.orderId.toString()}</span>
          </div>
          <div className="text-sm text-roots-gray mt-1">
            Opened {formatDistanceToNow(new Date(Number(dispute.createdAt) * 1000), { addSuffix: true })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dispute.resolved ? (
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              dispute.adminResolved
                ? 'bg-yellow-100 text-yellow-700'
                : dispute.buyerWon
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
            }`}>
              {dispute.adminResolved ? 'Admin Resolved' : dispute.buyerWon ? 'Buyer Won' : 'Seller Won'}
            </span>
          ) : votingEnded ? (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
              Voting Ended
            </span>
          ) : (
            <span className="px-2 py-1 bg-roots-primary/10 text-roots-primary rounded text-xs font-medium">
              Voting Open
            </span>
          )}
        </div>
      </div>

      {/* Buyer Reason */}
      <div className="mb-3">
        <div className="text-xs font-medium text-roots-gray mb-1">Buyer's Reason</div>
        <div className="text-sm bg-gray-50 rounded p-2">{dispute.buyerReason || 'No reason provided'}</div>
      </div>

      {/* Seller Response */}
      {dispute.sellerResponse && (
        <div className="mb-3">
          <div className="text-xs font-medium text-roots-gray mb-1">Seller's Response</div>
          <div className="text-sm bg-gray-50 rounded p-2">{dispute.sellerResponse}</div>
        </div>
      )}

      {/* Votes */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div>
          <span className="text-roots-gray">Votes:</span>{' '}
          <span className="font-medium">{totalVotes}</span>
        </div>
        <div>
          <span className="text-blue-600">Buyer: {dispute.votesForBuyer.toString()}</span>
        </div>
        <div>
          <span className="text-green-600">Seller: {dispute.votesForSeller.toString()}</span>
        </div>
      </div>

      {/* Admin Reason (if admin resolved) */}
      {dispute.adminResolved && dispute.adminReason && (
        <div className="mb-3">
          <div className="text-xs font-medium text-yellow-700 mb-1">Admin Reason</div>
          <div className="text-sm bg-yellow-50 rounded p-2">{dispute.adminReason}</div>
        </div>
      )}

      {/* Actions */}
      {isOpen && onResolve && (
        <div className="flex justify-end pt-2 border-t">
          <Button size="sm" onClick={onResolve}>
            Admin Resolve
          </Button>
        </div>
      )}
    </div>
  );
}
