'use client';

import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { baseSepolia, base } from 'wagmi/chains';
import { ROOTS_TOKEN_ADDRESS } from '@/lib/contracts/marketplace';
import { useDemoMode, isDemoModeAvailable } from '@/contexts/DemoModeContext';
import { isTestWalletAvailable } from '@/lib/testWalletConnector';

// ERC20 balanceOf ABI
const erc20BalanceAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Token addresses by chain
// Note: USDC on testnet may not be available - only show on mainnet
const TOKEN_ADDRESSES = {
  // Base Sepolia (testnet) - no official USDC deployment
  [baseSepolia.id]: {
    // USDC not available on Base Sepolia testnet
  },
  // Base Mainnet
  [base.id]: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // Native USDC on Base
  },
} as const;

// Token metadata
const TOKEN_INFO = {
  ROOTS: { name: '$ROOTS', description: 'Local Roots Token', decimals: 18, color: 'bg-roots-primary', symbol: 'R' },
  USDC: { name: 'USDC', description: 'USD Coin', decimals: 6, color: 'bg-blue-500', symbol: '$' },
  ETH: { name: 'ETH', description: 'For gas fees', decimals: 18, color: 'bg-slate-600', symbol: 'E' },
};

export function FundsAvailable() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { isDemoMode, enableDemoMode, disableDemoMode, demoAddress, demoBalances } = useDemoMode();

  // Find test wallet connector
  const testWalletConnector = connectors.find((c) => c.id === 'testWallet');
  const canUseTestWallet = isTestWalletAvailable() && testWalletConnector;

  const handleUseTestWallet = () => {
    if (testWalletConnector) {
      disconnect();
      setTimeout(() => {
        connect({ connector: testWalletConnector });
      }, 100);
    }
  };

  // Get native ETH balance
  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address,
  });

  // Get ROOTS token balance
  const { data: rootsBalance, isLoading: rootsLoading, isError: rootsError } = useReadContract({
    address: ROOTS_TOKEN_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      retry: false, // Don't retry on error
    },
  });

  // Get USDC balance (chain-aware) - only on mainnet
  const chainId = chain?.id || baseSepolia.id;
  const chainConfig = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES];
  const usdcAddress = chainConfig && 'USDC' in chainConfig ? chainConfig.USDC : undefined;

  const { data: usdcBalance, isLoading: usdcLoading, isError: usdcError } = useReadContract({
    address: usdcAddress,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!usdcAddress,
      retry: false, // Don't retry on error
    },
  });

  // Show demo mode UI if enabled
  if (isDemoMode) {
    const formattedDemoRoots = parseFloat(formatUnits(demoBalances.ROOTS, 18)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedDemoEth = parseFloat(formatUnits(demoBalances.ETH, 18)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    return (
      <div className="bg-white rounded-lg border-2 border-amber-400 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-amber-600 flex items-center gap-2">
            🧪 Demo Mode
          </h3>
          <button
            onClick={disableDemoMode}
            className="text-xs text-roots-gray hover:text-red-600"
          >
            Exit
          </button>
        </div>

        <div className="space-y-2">
          <TokenRow
            symbol="R"
            name="$ROOTS"
            description="Demo Balance"
            balance={formattedDemoRoots}
            color="bg-roots-primary"
            highlight
          />
          <TokenRow
            symbol="E"
            name="ETH"
            description="Demo Balance"
            balance={formattedDemoEth}
            color="bg-slate-600"
          />
        </div>

        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-amber-600">
            Using simulated wallet for testing. Transactions won't be real.
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return null;
  }

  // Check if on correct network - currently only Base Sepolia (testnet) has our contracts
  // TODO: Update to include Base mainnet when we deploy there
  const isCorrectNetwork = chain?.id === baseSepolia.id;

  const isLoading = ethLoading || rootsLoading || (usdcAddress && usdcLoading);

  // Format balances
  const formatBalance = (balance: bigint | undefined, decimals: number, minDecimals: number = 2, maxDecimals: number = 2) => {
    if (!balance) return '0.00';
    const formatted = parseFloat(formatUnits(balance, decimals));
    return formatted.toLocaleString(undefined, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
  };

  // Only format if we have valid data (not error)
  const formattedRoots = !rootsError ? formatBalance(rootsBalance as bigint | undefined, 18) : null;
  const formattedUsdc = !usdcError && usdcAddress ? formatBalance(usdcBalance as bigint | undefined, 6) : null;
  const formattedEth = ethBalance
    ? parseFloat(ethBalance.formatted).toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      })
    : '0.0000';

  // Check if balances are zero (to show helpful message)
  const hasNoFunds =
    (!rootsBalance || rootsBalance === 0n || rootsError) &&
    (!usdcBalance || usdcBalance === 0n || usdcError || !usdcAddress) &&
    (!ethBalance || parseFloat(ethBalance.formatted) < 0.0001);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <h3 className="font-semibold text-sm text-roots-gray mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        Funds Available
      </h3>

      {/* Wrong network warning */}
      {!isCorrectNetwork && (
        <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-amber-800 text-xs font-medium mb-1">Wrong Network</p>
          <p className="text-amber-700 text-xs mb-2">
            You're on <strong>{chain?.name || 'Unknown'}</strong>. Local Roots uses Base Sepolia testnet.
          </p>
          {canUseTestWallet ? (
            <button
              onClick={handleUseTestWallet}
              disabled={isConnecting}
              className="w-full px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Use Test Wallet (Base Sepolia)'}
            </button>
          ) : (
            <p className="text-amber-700 text-xs">
              Configure NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY in .env.local to use the test wallet.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 bg-gray-100 rounded animate-pulse" />
          <div className="h-14 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* ROOTS Token - only show if loaded successfully */}
          {formattedRoots !== null && (
            <TokenRow
              symbol="R"
              name="$ROOTS"
              description="Local Roots Token"
              balance={formattedRoots}
              color="bg-roots-primary"
              highlight
            />
          )}

          {/* USDC - only show on mainnet and if loaded successfully */}
          {formattedUsdc !== null && (
            <TokenRow
              symbol="$"
              name="USDC"
              description="USD Coin"
              balance={formattedUsdc}
              color="bg-blue-500"
            />
          )}

          {/* ETH */}
          <TokenRow
            symbol="E"
            name="ETH"
            description="For gas fees"
            balance={formattedEth}
            color="bg-slate-600"
          />
        </div>
      )}

      {/* Helpful message if no funds */}
      {hasNoFunds && !isLoading && (
        <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-800">
            <strong>Need funds?</strong> Get testnet ETH from a{' '}
            <a
              href="https://www.coinbase.com/faucets/base-sepolia-faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Base Sepolia faucet
            </a>
          </p>
        </div>
      )}

      {/* Network indicator */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="text-xs text-roots-gray">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-roots-gray">
          {chain?.name || 'Base Sepolia'}
        </div>
      </div>
    </div>
  );
}

// Token row component
function TokenRow({
  symbol,
  name,
  description,
  balance,
  color,
  highlight = false
}: {
  symbol: string;
  name: string;
  description: string;
  balance: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${highlight ? 'bg-roots-primary/5' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
          <span className="text-white text-xs font-bold">{symbol}</span>
        </div>
        <div>
          <div className="font-medium text-sm">{name}</div>
          <div className="text-xs text-roots-gray">{description}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{balance}</div>
      </div>
    </div>
  );
}
