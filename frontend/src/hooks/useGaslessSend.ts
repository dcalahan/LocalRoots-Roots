'use client';

/**
 * useGaslessSend — gasless USDC transfer from a Privy embedded wallet.
 *
 * Companion to `useTokenApproval`'s permit flow (Apr 27 2026). Same architecture:
 *   1. User signs EIP-2612 permit off-chain (free, no ETH needed)
 *   2. Permit names our RELAYER as spender (not marketplace — this is Send, not Buy)
 *   3. /api/relay-usdc-send submits permit() + transferFrom() in sequence
 *   4. USDC moves from user → recipient; relayer pays gas
 *
 * Why this exists: `/wallet`'s Send flow used `useSendToken`, which calls
 * `usdc.transfer()` directly from the Privy embedded wallet. Privy wallets
 * hold no ETH (Doug's rule: "Users should never have to have ETH"), so the
 * direct-transfer path fails with "insufficient funds for gas." Verified
 * May 18 2026 on Doug's incognito wallet with ~$16.83 USDC.
 *
 * Currently USDC-only. To add USDT or another permit-supporting token:
 *   1. Verify on-chain that the token's permit() uses the standard EIP-2612 typehash
 *   2. Verify the EIP-712 domain (name, version) — domains differ per token
 *   3. Add to ALLOWED_TOKENS in /api/relay-usdc-send/route.ts
 *   4. Extend USDC_PERMIT_DOMAIN here to be a per-token map
 *   Both ends MUST change together.
 */

import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { type Address } from 'viem';
import { ACTIVE_CHAIN_ID } from '@/lib/chainConfig';
import { USDC_ADDRESS } from '@/lib/contracts/marketplace';

// EIP-2612 nonces() reader. Same as useTokenApproval — duplicated here to
// avoid coupling the two hooks. If a third permit-using hook appears, this
// is the spot to extract a shared `lib/permit.ts` module.
const permitNoncesAbi = [
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// USDC v2.2 on Base mainnet EIP-712 domain — hardcoded because USDC's
// `eip712Domain()` (EIP-5267) reverts on this implementation. Verified
// on-chain Apr 27 2026 (see useTokenApproval.ts for the audit trail).
const USDC_PERMIT_DOMAIN = {
  name: 'USD Coin',
  version: '2',
};

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

interface SendParams {
  /** Recipient wallet address. */
  recipient: Address;
  /** Amount to send in base units (1 USDC = 1_000_000n). */
  amount: bigint;
}

interface SendResult {
  permitHash: `0x${string}`;
  transferHash: `0x${string}`;
}

interface UseGaslessSendResult {
  sendUsdcGasless: (params: SendParams) => Promise<SendResult | null>;
  isSending: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGaslessSend(): UseGaslessSendResult {
  const { wallets } = useWallets();
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID });

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Privy embedded wallet is the only supported owner. External wallets
  // can use the normal `useSendToken` path — they have ETH for gas.
  const privyEmbeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const address = privyEmbeddedWallet?.address as Address | undefined;

  const clearError = useCallback(() => setError(null), []);

  const sendUsdcGasless = useCallback(
    async (params: SendParams): Promise<SendResult | null> => {
      if (!privyEmbeddedWallet || !address || !publicClient) {
        setError('Privy wallet not ready');
        return null;
      }

      if (params.amount <= 0n) {
        setError('Amount must be greater than 0');
        return null;
      }

      if (params.recipient.toLowerCase() === address.toLowerCase()) {
        setError('Cannot send to your own address');
        return null;
      }

      // Relayer wallet address on Base mainnet. The permit names this
      // wallet as spender; after the permit lands, `/api/relay-usdc-send`
      // calls transferFrom from this same wallet. Hardcoded with optional
      // env override to match the fallback-address pattern used elsewhere
      // (see e.g. `lib/contracts/marketplace.ts`). If the relayer wallet
      // ever changes, update both this fallback AND the server-side
      // RELAYER_PRIVATE_KEY in Vercel.
      const relayerAddress = (process.env.NEXT_PUBLIC_RELAYER_ADDRESS ||
        '0xe2034722F2973814CF829179889b7C27D8D00452') as Address;

      setIsSending(true);
      setError(null);

      try {
        // Read current nonce from the USDC contract.
        const nonce = (await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: permitNoncesAbi,
          functionName: 'nonces',
          args: [address],
        })) as bigint;

        // 30-minute deadline — same window as useTokenApproval. User has
        // time to confirm the signature, relayer has time to broadcast
        // even under network congestion.
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        const domain = {
          name: USDC_PERMIT_DOMAIN.name,
          version: USDC_PERMIT_DOMAIN.version,
          chainId: ACTIVE_CHAIN_ID,
          verifyingContract: USDC_ADDRESS,
        };

        const message = {
          owner: address,
          spender: relayerAddress,
          value: params.amount,
          nonce,
          deadline,
        };

        console.log('[useGaslessSend] Requesting permit signature:', {
          owner: address,
          spender: relayerAddress,
          recipient: params.recipient,
          value: params.amount.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        });

        const provider = await privyEmbeddedWallet.getEthereumProvider();

        const signature = (await provider.request({
          method: 'eth_signTypedData_v4',
          params: [
            address,
            JSON.stringify({
              types: {
                EIP712Domain: [
                  { name: 'name', type: 'string' },
                  { name: 'version', type: 'string' },
                  { name: 'chainId', type: 'uint256' },
                  { name: 'verifyingContract', type: 'address' },
                ],
                ...PERMIT_TYPES,
              },
              primaryType: 'Permit',
              domain,
              message,
            }),
          ],
        })) as string;

        const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
        if (sig.length !== 130) {
          throw new Error(`Unexpected signature length: ${sig.length}`);
        }
        const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
        const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
        const v = parseInt(sig.slice(128, 130), 16);

        const response = await fetch('/api/relay-usdc-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: USDC_ADDRESS,
            owner: address,
            recipient: params.recipient,
            amount: params.amount.toString(),
            deadline: deadline.toString(),
            v,
            r,
            s,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('[useGaslessSend] Relay error:', result);
          throw new Error(result.error || 'Gasless send failed');
        }

        console.log('[useGaslessSend] Send confirmed:', {
          permit: result.permitHash,
          transfer: result.transferHash,
        });

        return {
          permitHash: result.permitHash,
          transferHash: result.transferHash,
        };
      } catch (err: unknown) {
        console.error('[useGaslessSend] Error:', err);
        const message = err instanceof Error ? err.message : 'Gasless send failed';
        if (
          message.toLowerCase().includes('rejected') ||
          message.toLowerCase().includes('denied')
        ) {
          setError('Transaction was cancelled');
        } else {
          setError(message);
        }
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [privyEmbeddedWallet, address, publicClient],
  );

  return {
    sendUsdcGasless,
    isSending,
    error,
    clearError,
  };
}
