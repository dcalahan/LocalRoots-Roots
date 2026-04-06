/**
 * Central chain configuration.
 *
 * Flip between Base Sepolia (testnet) and Base mainnet with a single env var:
 *   NEXT_PUBLIC_NETWORK=mainnet  → Base mainnet
 *   (unset or anything else)     → Base Sepolia (default)
 *
 * All contract reads, writes, viem clients, relayer, and BaseScan links
 * should import ACTIVE_CHAIN / ACTIVE_CHAIN_ID / RPC_URL / EXPLORER_URL
 * from this module instead of hardcoding `baseSepolia` or 84532.
 */
import { base, baseSepolia } from 'viem/chains';
import type { Chain } from 'viem';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK?.toLowerCase();
export const IS_MAINNET = NETWORK === 'mainnet';

export const ACTIVE_CHAIN: Chain = IS_MAINNET ? base : baseSepolia;
export const ACTIVE_CHAIN_ID = ACTIVE_CHAIN.id;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (IS_MAINNET ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

export const EXPLORER_URL = IS_MAINNET
  ? 'https://basescan.org'
  : 'https://sepolia.basescan.org';

export const NETWORK_LABEL = IS_MAINNET ? 'Base' : 'Base Sepolia';
