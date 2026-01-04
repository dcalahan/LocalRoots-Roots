'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ThirdwebProvider, useSetActiveWallet, useActiveWallet } from 'thirdweb/react';
import { EIP1193 } from 'thirdweb/wallets';
import { getContract, prepareContractCall } from 'thirdweb';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Create thirdweb client (we know client ID exists if this file is loaded)
const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Base Sepolia chain definition
const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpc: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  blockExplorers: [
    {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  ],
  testnet: true,
});

// Test component that bridges Privy wallet to thirdweb
function PrivyThirdwebBridge() {
  const { wallets } = useWallets();
  const setActiveWallet = useSetActiveWallet();
  const activeWallet = useActiveWallet();
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const bridgeWallet = async () => {
    if (!wallets || wallets.length === 0) {
      setError('No Privy wallet found. Please login first.');
      setBridgeStatus('error');
      return;
    }

    setBridgeStatus('connecting');
    setError(null);

    try {
      const privyWallet = wallets[0];
      console.log('[Bridge] Privy wallet:', privyWallet.address);

      // Get the ethereum provider from Privy
      const provider = await privyWallet.getEthereumProvider();
      console.log('[Bridge] Got Ethereum provider');

      // Create thirdweb wallet from EIP1193 provider
      const thirdwebWallet = EIP1193.fromProvider({
        provider: provider as any,
      });
      console.log('[Bridge] Created thirdweb wallet');

      // Connect the wallet
      await thirdwebWallet.connect({ client: thirdwebClient });
      console.log('[Bridge] Connected thirdweb wallet');

      // Set as active wallet
      setActiveWallet(thirdwebWallet);
      console.log('[Bridge] Set as active wallet');

      setBridgeStatus('connected');
    } catch (err) {
      console.error('[Bridge] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to bridge wallet');
      setBridgeStatus('error');
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Step 2: Bridge Privy Wallet to thirdweb</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm">
            <p><strong>Privy Wallets:</strong> {wallets.length > 0 ? wallets.map(w => w.address).join(', ') : 'None'}</p>
            <p><strong>thirdweb Active Wallet:</strong> {activeWallet ? 'Connected' : 'Not connected'}</p>
            <p><strong>Bridge Status:</strong> {bridgeStatus}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button onClick={bridgeWallet} disabled={bridgeStatus === 'connecting'}>
            {bridgeStatus === 'connecting' ? 'Bridging...' : 'Bridge Wallet'}
          </Button>

          {bridgeStatus === 'connected' && (
            <div className="bg-green-50 border border-green-200 rounded p-3 text-green-700 text-sm">
              Wallet successfully bridged to thirdweb!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Test component for TransactionWidget
function TransactionTest() {
  const activeWallet = useActiveWallet();
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!activeWallet) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Step 3: Test Transaction Preparation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Bridge wallet first to test transactions.</p>
        </CardContent>
      </Card>
    );
  }

  const testPrepareTransaction = async () => {
    try {
      // Get the marketplace contract
      const contract = getContract({
        client: thirdwebClient,
        chain: baseSepolia,
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi as any,
      });

      // Prepare a read call first (safer for testing)
      const prepared = prepareContractCall({
        contract,
        method: "function nextListingId() view returns (uint256)",
        params: [],
      });

      console.log('[Transaction] Prepared transaction:', prepared);
      setTestResult(`Transaction prepared successfully! Contract: ${MARKETPLACE_ADDRESS}`);
    } catch (err) {
      console.error('[Transaction] Error:', err);
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Step 3: Test Transaction Preparation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This tests if we can prepare transactions for the marketplace contract.
          </p>

          <Button onClick={testPrepareTransaction}>
            Test Prepare Transaction
          </Button>

          {testResult && (
            <div className={`p-3 rounded text-sm ${testResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {testResult}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main test page content (inside ThirdwebProvider)
function TestPageContent() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return <div className="p-8">Loading Privy...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">thirdweb Integration Test</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Step 1: Privy Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm">
              <p><strong>Status:</strong> {authenticated ? 'Authenticated' : 'Not authenticated'}</p>
              {user && (
                <>
                  <p><strong>User ID:</strong> {user.id}</p>
                  <p><strong>Email:</strong> {user.email?.address || 'N/A'}</p>
                  <p><strong>Wallet:</strong> {user.wallet?.address || 'N/A'}</p>
                </>
              )}
            </div>

            {authenticated ? (
              <Button variant="outline" onClick={logout}>Logout</Button>
            ) : (
              <Button onClick={login}>Login with Privy</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {authenticated && <PrivyThirdwebBridge />}
      {authenticated && <TransactionTest />}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Step 4: Test Pay Widget (Next)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            Once steps 1-3 work, we'll add TransactionWidget with fiat payment support.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1">
            <p><strong>thirdweb Client ID:</strong> <span className="text-green-600">Set</span></p>
            <p><strong>Privy App ID:</strong> {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? <span className="text-green-600">Set</span> : <span className="text-red-600">Not set</span>}</p>
            <p><strong>Marketplace Address:</strong> {MARKETPLACE_ADDRESS}</p>
            <p><strong>Chain:</strong> Base Sepolia (84532)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Exported test page wrapped in ThirdwebProvider
export function TestPage() {
  return (
    <ThirdwebProvider>
      <TestPageContent />
    </ThirdwebProvider>
  );
}
