'use client';

import { EXPLORER_URL } from '@/lib/chainConfig';

import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSendToken } from '@/hooks/useSendToken';
import { useGaslessSend } from '@/hooks/useGaslessSend';
import {
  useWalletBalances,
  formatBalance,
  type TokenBalance,
  type TokenSymbol,
} from '@/hooks/useWalletBalances';
import { isAddress, parseUnits, type Address } from 'viem';

interface SendTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'form' | 'confirm' | 'pending' | 'success' | 'error';

export function SendTokenModal({ isOpen, onClose, onSuccess }: SendTokenModalProps) {
  const { balances, refetch: refetchBalances } = useWalletBalances();
  const { send, estimateGas, isPending, error, txHash, clearError } = useSendToken();
  const {
    sendUsdcGasless,
    isSending: isSendingGasless,
    error: gaslessError,
    clearError: clearGaslessError,
  } = useGaslessSend();

  // Detect Privy embedded wallet — that's the gas-less population we built
  // useGaslessSend for. External wallets (MetaMask etc.) take the direct
  // useSendToken path; they have ETH.
  const { wallets } = useWallets();
  const isPrivyWallet = !!wallets.find((w) => w.walletClientType === 'privy');

  // Form state
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('ROOTS');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [step, setStep] = useState<ModalStep>('form');
  const [validationError, setValidationError] = useState<string | null>(null);
  // Tx hash captured from the gasless path — useSendToken's `txHash` is
  // only populated by the direct path. We unify these in the render so
  // both paths show a BaseScan link.
  const [gaslessTxHash, setGaslessTxHash] = useState<`0x${string}` | null>(null);

  // Get selected token balance
  const selectedBalance = balances.find((b) => b.symbol === selectedToken);

  // Use the gasless path for USDC sent from a Privy wallet. This is the
  // architectural fix for "users hold no ETH" — see useGaslessSend.ts
  // header comment. Other token types (ROOTS, ETH, USDT) still take the
  // direct-transfer path because permit support varies.
  const useGaslessPath = isPrivyWallet && selectedToken === 'USDC';

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setRecipient('');
      setAmount('');
      setGasEstimate(null);
      setValidationError(null);
      setGaslessTxHash(null);
      clearError();
      clearGaslessError();
    }
  }, [isOpen, clearError, clearGaslessError]);

  // Update gas estimate when form changes. Skip the estimate entirely on
  // the gasless path — the relayer pays gas, the user sees nothing.
  useEffect(() => {
    if (useGaslessPath) {
      setGasEstimate(null);
      return;
    }
    const updateGasEstimate = async () => {
      if (!recipient || !amount || !isAddress(recipient)) {
        setGasEstimate(null);
        return;
      }

      const estimate = await estimateGas({
        token: selectedToken,
        recipient,
        amount,
      });

      if (estimate) {
        setGasEstimate(`~${parseFloat(estimate.totalCostEth).toFixed(6)} ETH`);
      }
    };

    const timer = setTimeout(updateGasEstimate, 500);
    return () => clearTimeout(timer);
  }, [selectedToken, recipient, amount, estimateGas, useGaslessPath]);

  // Handle MAX button
  const handleMax = () => {
    if (selectedBalance) {
      // For ETH, leave some for gas
      if (selectedToken === 'ETH') {
        const balance = parseFloat(selectedBalance.formattedBalance);
        const maxAmount = Math.max(0, balance - 0.001); // Leave 0.001 ETH for gas
        setAmount(maxAmount.toString());
      } else {
        setAmount(selectedBalance.formattedBalance);
      }
    }
  };

  // Validate form
  const validate = (): boolean => {
    if (!recipient) {
      setValidationError('Recipient address is required');
      return false;
    }

    if (!isAddress(recipient)) {
      setValidationError('Invalid recipient address');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setValidationError('Amount must be greater than 0');
      return false;
    }

    if (selectedBalance) {
      const balance = parseFloat(selectedBalance.formattedBalance);
      if (parseFloat(amount) > balance) {
        setValidationError(`Insufficient ${selectedToken} balance`);
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  // Handle review button
  const handleReview = () => {
    if (validate()) {
      setStep('confirm');
    }
  };

  // Handle send. Branches between gasless (USDC + Privy) and direct paths.
  const handleSend = async () => {
    setStep('pending');

    if (useGaslessPath) {
      // USDC base units (6 decimals).
      const amountBaseUnits = parseUnits(amount, 6);
      const result = await sendUsdcGasless({
        recipient: recipient as Address,
        amount: amountBaseUnits,
      });

      if (result) {
        setGaslessTxHash(result.transferHash);
        setStep('success');
        refetchBalances();
        onSuccess?.();
      } else {
        setStep('error');
      }
      return;
    }

    const result = await send({
      token: selectedToken,
      recipient,
      amount,
    });

    if (result) {
      setStep('success');
      refetchBalances();
      onSuccess?.();
    } else {
      setStep('error');
    }
  };

  // Combined values that work across both send paths.
  const effectiveTxHash = gaslessTxHash ?? txHash;
  const effectiveError = gaslessError ?? error;
  const effectiveIsPending = useGaslessPath ? isSendingGasless : isPending;

  // Handle close
  const handleClose = () => {
    if (!effectiveIsPending) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {step === 'form' && 'Send Tokens'}
              {step === 'confirm' && 'Confirm Send'}
              {step === 'pending' && 'Sending...'}
              {step === 'success' && 'Sent!'}
              {step === 'error' && 'Send Failed'}
            </h2>
            {!effectiveIsPending && (
              <button
                onClick={handleClose}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Form Step */}
          {step === 'form' && (
            <div className="space-y-4">
              {/* Token Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token
                </label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value as TokenSymbol)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-roots-primary focus:border-transparent"
                >
                  {balances.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.icon} {token.symbol} - {formatBalance(token.formattedBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-roots-primary focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <button
                    type="button"
                    onClick={handleMax}
                    className="text-xs text-roots-primary hover:underline"
                  >
                    MAX
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-roots-primary focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {selectedToken}
                  </span>
                </div>
                {selectedBalance && (
                  <p className="mt-1 text-xs text-roots-gray">
                    Balance: {formatBalance(selectedBalance.formattedBalance)} {selectedToken}
                  </p>
                )}
              </div>

              {/* Gas Estimate — direct path shows estimated ETH cost.
                  Gasless path shows "Free — LocalRoots covers gas" so the
                  buyer understands they're not paying gas (and shouldn't
                  panic about not holding ETH). */}
              {gasEstimate && (
                <div className="text-sm text-roots-gray">
                  Estimated gas: {gasEstimate}
                </div>
              )}
              {useGaslessPath && recipient && amount && (
                <div className="text-sm text-roots-secondary flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Free — LocalRoots covers the network fee
                </div>
              )}

              {/* Validation Error */}
              {validationError && (
                <div className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationError}
                </div>
              )}

              {/* Review Button */}
              <Button
                onClick={handleReview}
                className="w-full bg-roots-primary hover:bg-roots-primary/90"
              >
                Review Send
              </Button>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-roots-gray">Sending</span>
                  <span className="font-medium">
                    {amount} {selectedToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-roots-gray">To</span>
                  <span className="font-mono text-sm">
                    {recipient.slice(0, 8)}...{recipient.slice(-6)}
                  </span>
                </div>
                {gasEstimate && (
                  <div className="flex justify-between">
                    <span className="text-roots-gray">Est. Gas</span>
                    <span className="text-sm">{gasEstimate}</span>
                  </div>
                )}
                {useGaslessPath && (
                  <div className="flex justify-between">
                    <span className="text-roots-gray">Network fee</span>
                    <span className="text-sm text-roots-secondary">
                      Free (gas paid by LocalRoots)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSend}
                  className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
                >
                  Confirm Send
                </Button>
              </div>
            </div>
          )}

          {/* Pending Step */}
          {step === 'pending' && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-roots-primary mx-auto mb-4" />
              <p className="text-roots-gray">
                {effectiveTxHash ? 'Confirming transaction...' : 'Waiting for wallet approval...'}
              </p>
              {effectiveTxHash && (
                <a
                  href={`${EXPLORER_URL}/tx/${effectiveTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-roots-secondary hover:underline inline-flex items-center"
                >
                  View on BaseScan
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Transaction Sent!</h3>
              <p className="text-roots-gray mb-4">
                {amount} {selectedToken} sent to {recipient.slice(0, 8)}...{recipient.slice(-6)}
              </p>
              {effectiveTxHash && (
                <a
                  href={`${EXPLORER_URL}/tx/${effectiveTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-roots-secondary hover:underline inline-flex items-center mb-4"
                >
                  View on BaseScan
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Transaction Failed</h3>
              <p className="text-roots-gray mb-4">{effectiveError || 'Something went wrong'}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button
                  onClick={() => setStep('form')}
                  className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
