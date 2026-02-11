'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSendToken } from '@/hooks/useSendToken';
import {
  useWalletBalances,
  formatBalance,
  type TokenBalance,
  type TokenSymbol,
} from '@/hooks/useWalletBalances';
import { isAddress } from 'viem';

interface SendTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'form' | 'confirm' | 'pending' | 'success' | 'error';

export function SendTokenModal({ isOpen, onClose, onSuccess }: SendTokenModalProps) {
  const { balances, refetch: refetchBalances } = useWalletBalances();
  const { send, estimateGas, isPending, error, txHash, clearError } = useSendToken();

  // Form state
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('ROOTS');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [step, setStep] = useState<ModalStep>('form');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get selected token balance
  const selectedBalance = balances.find((b) => b.symbol === selectedToken);

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setRecipient('');
      setAmount('');
      setGasEstimate(null);
      setValidationError(null);
      clearError();
    }
  }, [isOpen, clearError]);

  // Update gas estimate when form changes
  useEffect(() => {
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
  }, [selectedToken, recipient, amount, estimateGas]);

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

  // Handle send
  const handleSend = async () => {
    setStep('pending');

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

  // Handle close
  const handleClose = () => {
    if (!isPending) {
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
            {!isPending && (
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

              {/* Gas Estimate */}
              {gasEstimate && (
                <div className="text-sm text-roots-gray">
                  Estimated gas: {gasEstimate}
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
                {txHash ? 'Confirming transaction...' : 'Waiting for wallet approval...'}
              </p>
              {txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
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
              {txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
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
              <p className="text-roots-gray mb-4">{error || 'Something went wrong'}</p>
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
