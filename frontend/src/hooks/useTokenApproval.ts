'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { type Address } from 'viem';
import { ACTIVE_CHAIN_ID } from '@/lib/chainConfig';
import {
  MARKETPLACE_ADDRESS,
  ROOTS_TOKEN_ADDRESS,
  USDC_ADDRESS,
  erc20Abi,
} from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';

// EIP-2612 permit nonces() reader (USDC v2.2 on Base supports this).
const permitNoncesAbi = [
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// EIP-712 domain for USDC on Base mainnet, verified on-chain Apr 27 2026:
//   name() → "USD Coin"
//   version() → "2"
// USDC's `eip712Domain()` (EIP-5267) reverts on this implementation, so we
// hard-code the values rather than reading them. If we ever extend permit
// support to USDT or another token, build a per-token domain map.
const USDC_PERMIT_DOMAIN = {
  name: 'USD Coin',
  version: '2',
};

// Standard EIP-2612 Permit type. Same shape across compliant ERC-20s.
const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export function useTokenApproval() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID });
  const { data: walletClient } = useWalletClient();
  const { wallets } = useWallets();

  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestWallet = connector?.id === 'testWallet';

  // Privy embedded wallet detection. The credit-card buyer flow auto-creates
  // a Privy embedded wallet (no ETH) — those need permit-based approval since
  // they can't pay gas for a normal `approve()` tx. External wallets (Privy
  // social login that brings a MetaMask, browser extensions) have ETH and
  // use the existing wagmi-walletClient path. Match by address so we route
  // correctly even if multiple wallets are connected.
  const privyEmbeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const isUsingPrivyEmbedded =
    !!privyEmbeddedWallet &&
    !!address &&
    privyEmbeddedWallet.address.toLowerCase() === address.toLowerCase();

  /**
   * Check the current allowance for a token
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const checkAllowance = useCallback(async (tokenAddress?: Address): Promise<bigint> => {
    console.log('[useTokenApproval] checkAllowance called, address:', address, 'token:', tokenAddress);
    if (!publicClient || !address) {
      console.log('[useTokenApproval] No publicClient or address, returning 0');
      return 0n;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    try {
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, MARKETPLACE_ADDRESS],
      }) as bigint;
      console.log('[useTokenApproval] Allowance:', allowance.toString());
      return allowance;
    } catch (err) {
      console.error('[useTokenApproval] Error checking allowance:', err);
      return 0n;
    }
  }, [publicClient, address]);

  /**
   * Privy-embedded permit flow: sign EIP-2612 typed data, relayer pays gas.
   * Used for credit-card buyers and any Privy embedded wallet that holds USDC
   * but no ETH. The user signs once (free), the relayer submits permit() on
   * USDC paying the ~50k gas, and the marketplace gains transferFrom rights.
   *
   * Only USDC is whitelisted today (USDC v2.2 on Base verified to support
   * EIP-2612). Add other tokens to USDC_PERMIT_DOMAIN + the relay endpoint's
   * allow-list together — never one without the other.
   */
  const permitApprove = useCallback(
    async (token: Address, amount: bigint): Promise<boolean> => {
      if (!privyEmbeddedWallet || !address || !publicClient) {
        setError('Privy wallet not ready');
        return false;
      }

      // Today only USDC is whitelisted on the relay-permit endpoint. If
      // someone tries to permit-approve another token, fall back to the
      // standard wallet-signed approve path below — that requires ETH but
      // it's the safer fallback than failing silently.
      if (token.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
        console.warn(
          '[useTokenApproval] permitApprove called for non-USDC token; permit relay only allows USDC.'
        );
        setError('Permit-based approval is only supported for USDC.');
        return false;
      }

      try {
        // Read the EIP-2612 nonce from the token contract. This must match
        // the on-chain value at submission time — if the user has any
        // pending permit, this read picks up the next nonce automatically.
        const nonce = (await publicClient.readContract({
          address: token,
          abi: permitNoncesAbi,
          functionName: 'nonces',
          args: [address],
        })) as bigint;

        // Long-ish deadline (30 minutes) so the user has time to confirm the
        // signature and the relayer has time to broadcast even under load.
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        const domain = {
          name: USDC_PERMIT_DOMAIN.name,
          version: USDC_PERMIT_DOMAIN.version,
          chainId: ACTIVE_CHAIN_ID,
          verifyingContract: token,
        };

        const message = {
          owner: address,
          spender: MARKETPLACE_ADDRESS,
          value: amount,
          nonce,
          deadline,
        };

        console.log('[useTokenApproval] Requesting permit signature via Privy:', {
          owner: address,
          spender: MARKETPLACE_ADDRESS,
          value: amount.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        });

        // Sign via Privy's embedded wallet provider. BigInts are auto-converted
        // to strings by lib/polyfills.ts's BigInt.prototype.toJSON shim, which
        // is required because JSON.stringify doesn't natively handle BigInt.
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

        console.log('[useTokenApproval] Permit signature obtained');

        // Split the 65-byte signature into v, r, s for the on-chain permit().
        const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
        if (sig.length !== 130) {
          throw new Error(`Unexpected signature length: ${sig.length}`);
        }
        const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
        const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
        const v = parseInt(sig.slice(128, 130), 16);

        // Send to the relayer endpoint. Relayer reads the request, validates
        // token + spender against its allowlist, and submits permit() paying
        // gas. Server-side wait for receipt means we don't need to poll
        // mainnet.base.org from the browser (which 403s under load).
        const response = await fetch('/api/relay-permit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            owner: address,
            spender: MARKETPLACE_ADDRESS,
            value: amount.toString(),
            deadline: deadline.toString(),
            v,
            r,
            s,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('[useTokenApproval] Permit relay error:', result);
          throw new Error(result.error || 'Permit relay failed');
        }

        console.log('[useTokenApproval] Permit confirmed:', result.transactionHash);
        return true;
      } catch (err: unknown) {
        console.error('[useTokenApproval] Permit error:', err);
        const message =
          err instanceof Error ? err.message : 'Permit-based approval failed';
        if (
          message.toLowerCase().includes('rejected') ||
          message.toLowerCase().includes('denied') ||
          message.toLowerCase().includes('cancelled')
        ) {
          setError('Signature was cancelled. Please try again.');
        } else {
          setError(message);
        }
        return false;
      }
    },
    [privyEmbeddedWallet, address, publicClient]
  );

  /**
   * Approve a token for spending by the marketplace
   * @param amount Amount to approve
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const approve = useCallback(async (amount: bigint, tokenAddress?: Address): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    setIsApproving(true);
    setError(null);

    try {
      // Always start with an allowance check — if it's already sufficient
      // (from a prior permit, prior approval, or partial spend), nothing to
      // do. Saves a relay call and a signature prompt.
      const currentAllowance = await checkAllowance(token);

      if (currentAllowance >= amount) {
        return true;
      }

      // Privy embedded wallets have no ETH, so they can't sign a normal
      // approve() tx. Route them through the EIP-2612 permit relay, which
      // is gasless from the user's perspective. Only USDC is supported on
      // the permit relay today; other tokens fall through to the wallet-
      // signed path (and will fail without ETH — which is correct: those
      // flows aren't expected for embedded wallets in v1).
      if (
        isUsingPrivyEmbedded &&
        token.toLowerCase() === USDC_ADDRESS.toLowerCase()
      ) {
        console.log('[useTokenApproval] Using EIP-2612 permit via relayer (Privy embedded wallet)');
        return await permitApprove(token, amount);
      }

      // Non-test, non-permit paths require a wallet client.
      if (!isTestWallet && !walletClient) {
        setError('Wallet not connected');
        return false;
      }

      let hash: `0x${string}`;

      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[useTokenApproval] Using direct test wallet transaction for token:', token);
        hash = await testWalletWriteContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amount],
          gas: 100000n,
        });
      } else {
        hash = await walletClient!.writeContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amount],
        });
      }

      // Wait for confirmation, but bound the wait so a single bad RPC
      // doesn't hang the UI forever. If the receipt fetch times out, fall
      // back to reading the on-chain allowance — if it's >= amount, the
      // approval landed and we can proceed. The double-check guards against
      // the rare case where the RPC node serving us is desynced or 403'd.
      if (publicClient) {
        try {
          await publicClient.waitForTransactionReceipt({
            hash,
            timeout: 30_000,
          });
        } catch (waitErr) {
          console.warn(
            '[useTokenApproval] waitForTransactionReceipt timed out — falling back to allowance read',
            waitErr
          );
          const fallbackAllowance = await checkAllowance(token);
          if (fallbackAllowance < amount) {
            throw new Error(
              'Approval transaction did not confirm in time. Please try again.'
            );
          }
        }
      }

      return true;
    } catch (err: unknown) {
      console.error('[useTokenApproval] Approval error:', err);
      if (err instanceof Error) {
        console.error('[useTokenApproval] Error details:', {
          name: err.name,
          message: err.message,
          cause: (err as { cause?: unknown }).cause,
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [
    walletClient,
    address,
    publicClient,
    checkAllowance,
    isTestWallet,
    isUsingPrivyEmbedded,
    permitApprove,
  ]);

  /**
   * Get the balance of a token
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const getBalance = useCallback(async (tokenAddress?: Address): Promise<bigint> => {
    console.log('[useTokenApproval] getBalance called, address:', address, 'token:', tokenAddress);
    if (!publicClient || !address) {
      console.log('[useTokenApproval] No publicClient or address, returning 0');
      return 0n;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    try {
      const balance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;
      console.log('[useTokenApproval] Balance:', balance.toString());
      return balance;
    } catch (err) {
      console.error('[useTokenApproval] Error getting balance:', err);
      return 0n;
    }
  }, [publicClient, address]);

  return {
    checkAllowance,
    approve,
    getBalance,
    isApproving,
    error,
  };
}
