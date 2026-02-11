import { useQuery } from '@tanstack/react-query';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import {
  ROOTS_TOKEN_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
} from '@/lib/contracts/marketplace';

// ERC20 balanceOf ABI
const balanceOfAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export type TokenSymbol = 'ROOTS' | 'USDC' | 'USDT' | 'ETH';

export interface TokenBalance {
  symbol: TokenSymbol;
  name: string;
  balance: bigint;
  formattedBalance: string;
  decimals: number;
  usdValue: number;
  icon: string;
  address?: Address; // undefined for ETH
}

interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  address?: Address;
  decimals: number;
  icon: string;
  // Static USD price (will be replaced with live prices post-launch)
  usdPrice: number;
}

// Token configurations
const TOKEN_CONFIGS: TokenConfig[] = [
  {
    symbol: 'ROOTS',
    name: 'LocalRoots',
    address: ROOTS_TOKEN_ADDRESS,
    decimals: 18,
    icon: '🌱',
    usdPrice: 0.01, // Placeholder - will get real price from DEX
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: USDC_ADDRESS,
    decimals: 6,
    icon: '💵',
    usdPrice: 1.0,
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    address: USDT_ADDRESS,
    decimals: 6,
    icon: '💵',
    usdPrice: 1.0,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: undefined, // Native token
    decimals: 18,
    icon: '⚡',
    usdPrice: 2500, // Placeholder
  },
];

/**
 * Hook to fetch wallet balances for all supported tokens
 * Works with both Privy embedded wallets and external wagmi wallets
 */
export function useWalletBalances() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const publicClient = usePublicClient();

  // Get the wallet address (prefer Privy, fall back to wagmi)
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy');
  const walletAddress = (privyWallet?.address || wagmiAddress) as Address | undefined;

  const isConnected = authenticated || isWagmiConnected;

  const {
    data: balances,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['walletBalances', walletAddress],
    enabled: !!walletAddress && !!publicClient,
    queryFn: async (): Promise<TokenBalance[]> => {
      if (!walletAddress || !publicClient) {
        return [];
      }

      const results: TokenBalance[] = [];

      for (const config of TOKEN_CONFIGS) {
        let balance: bigint = 0n;

        try {
          if (config.symbol === 'ETH') {
            // Native ETH balance
            balance = await publicClient.getBalance({ address: walletAddress });
          } else if (config.address) {
            // ERC20 balance
            balance = await publicClient.readContract({
              address: config.address,
              abi: balanceOfAbi,
              functionName: 'balanceOf',
              args: [walletAddress],
            });
          }
        } catch (err) {
          console.error(`Error fetching ${config.symbol} balance:`, err);
          balance = 0n;
        }

        const formattedBalance = formatUnits(balance, config.decimals);
        const usdValue = parseFloat(formattedBalance) * config.usdPrice;

        results.push({
          symbol: config.symbol,
          name: config.name,
          balance,
          formattedBalance,
          decimals: config.decimals,
          usdValue,
          icon: config.icon,
          address: config.address,
        });
      }

      return results;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Calculate total USD value
  const totalUsdValue = balances?.reduce((sum, token) => sum + token.usdValue, 0) || 0;

  return {
    balances: balances || [],
    totalUsdValue,
    isLoading,
    error: error as Error | null,
    refetch,
    walletAddress,
    isConnected,
  };
}

/**
 * Format balance for display with appropriate precision
 */
export function formatBalance(balance: string | number, decimals: number = 2): string {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;

  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';

  // For small numbers, show more decimals
  if (num < 1) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  // For larger numbers, show fewer decimals
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format USD value for display
 */
export function formatUsdValue(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
