'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSafeOperations } from '@/hooks/useSafeOperations';
import { useOperationsTreasury } from '@/hooks/useOperationsTreasury';
import { formatUSDC, SERVICE_INFO } from '@/types/operations';
import { ServiceBudgetCard } from './ServiceBudgetCard';
import { SafeSignerStatus } from './SafeSignerStatus';

export function OperationsTab() {
  const {
    safeInfo,
    pendingTransactions,
    isLoading: safeLoading,
    error: safeError,
    isSigner,
    refresh: refreshSafe,
    safeAppUrl,
  } = useSafeOperations();

  const {
    balance,
    services,
    isLoading: treasuryLoading,
    error: treasuryError,
    refresh: refreshTreasury,
  } = useOperationsTreasury();

  const isLoading = safeLoading || treasuryLoading;
  const error = safeError || treasuryError;

  const handleRefresh = () => {
    refreshSafe();
    refreshTreasury();
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-roots-gray">
        Loading operations treasury...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="font-semibold text-lg mb-2">Configuration Required</h3>
        <p className="text-roots-gray mb-4">{error}</p>
        <div className="text-sm text-gray-500 space-y-2">
          <p>To enable the Operations Treasury:</p>
          <ol className="list-decimal list-inside text-left max-w-md mx-auto">
            <li>Create a Gnosis Safe at app.safe.global</li>
            <li>Deploy the OperationsTreasury contract</li>
            <li>Set NEXT_PUBLIC_OPERATIONS_SAFE_ADDRESS in .env.local</li>
            <li>Set NEXT_PUBLIC_OPERATIONS_TREASURY_ADDRESS in .env.local</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            Operations Treasury
            <span className="text-sm font-normal text-roots-gray">
              (Gnosis Safe Controlled)
            </span>
          </h2>
          <p className="text-sm text-roots-gray mt-1">
            USDC treasury for paying external services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
          {safeAppUrl && (
            <a href={safeAppUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Open Safe App →
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Safe Status & Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Treasury Balance</p>
            <p className="text-3xl font-heading font-bold text-green-600">
              {balance !== null ? formatUSDC(balance) : '--'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Pending Transactions</p>
            <p className="text-3xl font-heading font-bold">
              {pendingTransactions.length}
            </p>
            {pendingTransactions.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Awaiting signatures
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Safe Signers</p>
            <p className="text-3xl font-heading font-bold">
              {safeInfo ? `${safeInfo.threshold}/${safeInfo.owners.length}` : '--'}
            </p>
            {safeInfo && (
              <p className="text-xs text-roots-gray mt-1">
                Required signatures
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signer Status */}
      <SafeSignerStatus isSigner={isSigner} safeInfo={safeInfo} />

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">External Services</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-roots-gray">
              <p className="mb-2">No services configured yet.</p>
              <p className="text-sm">
                Configure services via the Gnosis Safe Transaction Builder.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service) => (
                <ServiceBudgetCard key={service.serviceId} config={service} />
              ))}
            </div>
          )}

          {/* Placeholder for unconfigured services */}
          {services.length === 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Services to Configure:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(SERVICE_INFO).map(([key, info]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-60"
                  >
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <p className="font-medium">{info.name}</p>
                      <p className="text-xs text-roots-gray">{info.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Transactions */}
      {pendingTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              Pending Transactions
              <span className="text-sm font-normal text-amber-600">
                ({pendingTransactions.length} awaiting signatures)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div
                  key={tx.safeTxHash}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      Transaction to {tx.to.slice(0, 10)}...
                    </p>
                    <p className="text-sm text-roots-gray">
                      {tx.confirmations.length}/{safeInfo?.threshold || '?'} signatures
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isSigner && tx.confirmations.length < (safeInfo?.threshold || 0) && (
                      <Button size="sm" variant="outline">
                        Sign
                      </Button>
                    )}
                    <a
                      href={safeAppUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        View in Safe
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-2">How to Make Payments</h4>
          <ol className="list-decimal list-inside text-sm text-roots-gray space-y-1">
            <li>Go to the Gnosis Safe app (link above)</li>
            <li>Use Transaction Builder to call executePayment()</li>
            <li>Provide the service ID, amount (USDC with 6 decimals), and IPFS usage hash</li>
            <li>Submit for multisig approval</li>
            <li>Once threshold signatures are collected, the payment executes</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
