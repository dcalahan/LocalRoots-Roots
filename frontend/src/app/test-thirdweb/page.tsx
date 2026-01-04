'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamically import thirdweb to avoid build-time errors
// This allows the page to render even without a client ID
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

// Main page component - shows setup instructions if no client ID
export default function TestThirdwebPage() {
  if (!THIRDWEB_CLIENT_ID) {
    return <SetupInstructions />;
  }

  return <ThirdwebTestContent />;
}

// Setup instructions when client ID is missing
function SetupInstructions() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">thirdweb Integration Test</h1>

      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-800">Setup Required</CardTitle>
        </CardHeader>
        <CardContent className="text-amber-900">
          <p className="mb-4">
            To test thirdweb integration, you need to get a free client ID:
          </p>
          <ol className="list-decimal list-inside space-y-2 mb-4">
            <li>Go to <a href="https://thirdweb.com/dashboard" target="_blank" rel="noopener" className="text-blue-600 underline">thirdweb.com/dashboard</a></li>
            <li>Create a free account or sign in</li>
            <li>Create a new project</li>
            <li>Copy your Client ID</li>
            <li>Add to <code className="bg-amber-100 px-1 rounded">.env.local</code>:</li>
          </ol>
          <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto">
            NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id_here
          </pre>
          <p className="mt-4 text-sm">
            Then restart the dev server and refresh this page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1">
            <p><strong>thirdweb Client ID:</strong> <span className="text-red-600">Not set</span></p>
            <p><strong>Privy App ID:</strong> {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? <span className="text-green-600">Set</span> : <span className="text-red-600">Not set</span>}</p>
            <p><strong>Marketplace Address:</strong> {MARKETPLACE_ADDRESS}</p>
            <p><strong>Chain:</strong> Base Sepolia (84532)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// The actual test content - only rendered when we have a client ID
function ThirdwebTestContent() {
  // Lazy import thirdweb components only when we have a client ID
  const [ThirdwebComponents, setThirdwebComponents] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load thirdweb components on mount
  useState(() => {
    import('./thirdweb-test-components')
      .then(mod => setThirdwebComponents(mod))
      .catch(err => setLoadError(err.message));
  });

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">thirdweb Integration Test</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Failed to load thirdweb components: {loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ThirdwebComponents) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">thirdweb Integration Test</h1>
        <p>Loading thirdweb components...</p>
      </div>
    );
  }

  return <ThirdwebComponents.TestPage />;
}
