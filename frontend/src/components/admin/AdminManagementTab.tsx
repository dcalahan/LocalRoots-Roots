'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useGaslessTransaction } from '@/hooks/useGaslessTransaction';
import { useAccount } from 'wagmi';
import { isAddress, type Address } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { DISPUTE_RESOLUTION_ADDRESS, disputeResolutionAbi } from '@/lib/contracts/disputeResolution';

export function AdminManagementTab() {
  const { address } = useAccount();
  const { adminList, isLoading: loadingAdmins, refetch } = useAdminStatus();
  const { addAdmin, removeAdmin, isLoading: actionLoading, error } = useAdminActions();
  const { executeGasless, isLoading: whitelistLoading } = useGaslessTransaction();

  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [removeModal, setRemoveModal] = useState<string | null>(null);

  // Whitelist state
  const [whitelistAddress, setWhitelistAddress] = useState('');
  const [whitelistCheckAddress, setWhitelistCheckAddress] = useState('');
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  const checkWhitelist = useCallback(async () => {
    if (!isAddress(whitelistCheckAddress)) {
      setWhitelistError('Invalid address');
      return;
    }
    setWhitelistError(null);
    try {
      const result = await publicClient.readContract({
        address: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'whitelistedVoters',
        args: [whitelistCheckAddress as Address],
      });
      setIsWhitelisted(result as boolean);
    } catch (err) {
      setWhitelistError('Failed to check whitelist');
    }
  }, [whitelistCheckAddress]);

  const handleAddToWhitelist = async () => {
    if (!isAddress(whitelistAddress)) return;
    setWhitelistError(null);
    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'addWhitelistedVoter',
        args: [whitelistAddress as Address],
      });
      if (txHash) {
        setWhitelistAddress('');
        setWhitelistError(null);
      }
    } catch (err) {
      setWhitelistError(err instanceof Error ? err.message : 'Failed to add to whitelist');
    }
  };

  const handleRemoveFromWhitelist = async () => {
    if (!isAddress(whitelistAddress)) return;
    setWhitelistError(null);
    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'removeWhitelistedVoter',
        args: [whitelistAddress as Address],
      });
      if (txHash) {
        setWhitelistAddress('');
        setWhitelistError(null);
      }
    } catch (err) {
      setWhitelistError(err instanceof Error ? err.message : 'Failed to remove from whitelist');
    }
  };

  const handleAddAdmin = async () => {
    if (!isAddress(newAdminAddress)) {
      return;
    }
    const success = await addAdmin(newAdminAddress as Address);
    if (success) {
      setNewAdminAddress('');
      setShowAddModal(false);
      refetch();
    }
  };

  const handleRemoveAdmin = async (adminAddress: string) => {
    const success = await removeAdmin(adminAddress as Address);
    if (success) {
      setRemoveModal(null);
      refetch();
    }
  };

  const isValidAddress = newAdminAddress === '' || isAddress(newAdminAddress);
  const canRemoveSelf = adminList.length > 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-heading text-xl font-bold">Admin Management</h2>
          <p className="text-roots-gray text-sm">Manage who has admin access to the marketplace</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Add Admin</Button>
      </div>

      {/* Current Admins */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-medium mb-4">Current Administrators ({adminList.length})</h3>
        {loadingAdmins ? (
          <div className="text-center py-8 text-roots-gray">Loading admins...</div>
        ) : adminList.length === 0 ? (
          <div className="text-center py-8 text-roots-gray">No admins found</div>
        ) : (
          <div className="space-y-3">
            {adminList.map((admin, index) => (
              <div
                key={admin}
                className="flex items-center justify-between bg-white rounded-lg p-4 border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-roots-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-roots-primary font-bold">
                      {index === 0 ? 'P' : index + 1}
                    </span>
                  </div>
                  <div>
                    <a
                      href={`https://sepolia.basescan.org/address/${admin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:text-roots-primary"
                    >
                      {admin}
                    </a>
                    {admin.toLowerCase() === address?.toLowerCase() && (
                      <span className="ml-2 text-xs bg-roots-primary/10 text-roots-primary px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                    {index === 0 && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {admin.toLowerCase() !== address?.toLowerCase() ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRemoveModal(admin)}
                      disabled={actionLoading}
                    >
                      Remove
                    </Button>
                  ) : canRemoveSelf ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRemoveModal(admin)}
                      disabled={actionLoading}
                    >
                      Remove Self
                    </Button>
                  ) : (
                    <span className="text-xs text-roots-gray">Cannot remove last admin</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-6 bg-blue-50 rounded-xl p-6">
        <h3 className="font-medium text-blue-800 mb-2">Admin Permissions</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- Add and remove other administrators</li>
          <li>- Suspend and unsuspend sellers</li>
          <li>- Suspend ambassadors</li>
          <li>- Cancel fraudulent orders (refund buyer, clawback rewards)</li>
          <li>- View all marketplace data and activity</li>
        </ul>
      </div>

      {/* Voter Whitelist Section */}
      <div className="mt-6 bg-gray-50 rounded-xl p-6">
        <h3 className="font-medium mb-2">Voter Whitelist (Disputes &amp; Government Requests)</h3>
        <p className="text-sm text-roots-gray mb-4">
          Whitelisted voters can vote on disputes and government requests without needing an activated seller.
          Use during early stage before enough qualified voters exist.
        </p>

        {/* Check if address is whitelisted */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Check Whitelist Status</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={whitelistCheckAddress}
              onChange={(e) => {
                setWhitelistCheckAddress(e.target.value);
                setIsWhitelisted(null);
              }}
              placeholder="0x..."
              className="flex-1 p-2 border rounded-lg font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={checkWhitelist}
              disabled={!whitelistCheckAddress}
            >
              Check
            </Button>
          </div>
          {isWhitelisted !== null && (
            <p className={`text-sm mt-2 ${isWhitelisted ? 'text-green-600' : 'text-roots-gray'}`}>
              {isWhitelisted ? 'Address is whitelisted' : 'Address is NOT whitelisted'}
            </p>
          )}
        </div>

        {/* Add/Remove from whitelist */}
        <div>
          <label className="block text-sm font-medium mb-2">Add/Remove Voter</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={whitelistAddress}
              onChange={(e) => setWhitelistAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 p-2 border rounded-lg font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddToWhitelist}
              disabled={whitelistLoading || !isAddress(whitelistAddress)}
            >
              {whitelistLoading ? '...' : 'Add'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveFromWhitelist}
              disabled={whitelistLoading || !isAddress(whitelistAddress)}
            >
              {whitelistLoading ? '...' : 'Remove'}
            </Button>
          </div>
        </div>

        {whitelistError && (
          <p className="text-sm text-red-600 mt-2">{whitelistError}</p>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-heading text-xl font-bold mb-4">Add New Admin</h3>
            <p className="text-roots-gray mb-4">
              Enter the wallet address of the new administrator. They will have full admin access.
            </p>
            <input
              type="text"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="0x..."
              className={`w-full p-3 border rounded-lg mb-2 font-mono text-sm ${
                !isValidAddress ? 'border-red-500' : ''
              }`}
            />
            {!isValidAddress && (
              <p className="text-red-500 text-sm mb-4">Please enter a valid Ethereum address</p>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewAdminAddress('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAdmin}
                disabled={actionLoading || !newAdminAddress || !isValidAddress}
              >
                {actionLoading ? 'Adding...' : 'Add Admin'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Admin Confirmation Modal */}
      {removeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-heading text-xl font-bold mb-4">Remove Admin</h3>
            <p className="text-roots-gray mb-4">
              Are you sure you want to remove this admin?
            </p>
            <div className="bg-gray-100 p-3 rounded-lg mb-4">
              <code className="text-sm break-all">{removeModal}</code>
            </div>
            {removeModal.toLowerCase() === address?.toLowerCase() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> You are removing yourself. You will lose admin access.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setRemoveModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRemoveAdmin(removeModal)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Removing...' : 'Remove Admin'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
