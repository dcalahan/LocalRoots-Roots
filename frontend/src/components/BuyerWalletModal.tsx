'use client';

import { useState, useEffect } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import type { Connector } from 'wagmi';

interface BuyerWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: () => void; // Called when wallet successfully connects
  showCreditCardOption?: boolean;
  onCreditCardSelect?: () => void;
  switchWallet?: boolean; // Show disconnect option for switching wallets
  showPrivyOption?: boolean; // Show "Login with Email" option for credit card buyers to view orders
  onPrivyLogin?: () => void; // Called when user chooses to login with email
}

type ModalStep = 'choice' | 'connecting';

export function BuyerWalletModal({
  isOpen,
  onClose,
  onConnect,
  showCreditCardOption = false,
  onCreditCardSelect,
  switchWallet = false,
  showPrivyOption = false,
  onPrivyLogin,
}: BuyerWalletModalProps) {
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [step, setStep] = useState<ModalStep>('choice');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Track if we were connected when modal opened (for switch wallet mode)
  const [wasConnectedOnOpen, setWasConnectedOnOpen] = useState(false);
  const [modalReady, setModalReady] = useState(false);

  // Reset step when modal opens - this must run first
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setSelectedWallet(null);
      setWasConnectedOnOpen(isConnected);
      setModalReady(true);
      reset();
    } else {
      setModalReady(false);
    }
  }, [isOpen, reset, isConnected]);

  // Close modal on successful connection and notify parent
  // In switch wallet mode, only close when a NEW connection happens (was disconnected, now connected)
  useEffect(() => {
    // Don't run until modal is ready (wasConnectedOnOpen is set)
    if (!modalReady) return;

    if (isConnected && isOpen) {
      // If in switch mode and was already connected when opened, don't auto-close
      if (switchWallet && wasConnectedOnOpen) {
        return;
      }
      onConnect?.();
      onClose();
    }
  }, [isConnected, isOpen, onClose, onConnect, switchWallet, wasConnectedOnOpen, modalReady]);

  if (!isOpen) return null;

  // Debug: log available connectors
  console.log('[BuyerWalletModal] Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })));

  // Find connectors
  const testWalletConnector = connectors.find(c => c.id === 'testWallet');
  const walletConnectConnector = connectors.find(c => c.id === 'walletConnect');
  const coinbaseConnector = connectors.find(
    c => c.id === 'coinbaseWalletSDK' || c.name.toLowerCase().includes('coinbase')
  );
  const injectedConnector = connectors.find(c => c.id === 'injected');

  // Check if browser wallet is available
  const hasInjectedWallet = typeof window !== 'undefined' &&
    (window.ethereum !== undefined || (window as unknown as { web3?: unknown }).web3 !== undefined);

  const handleConnectWallet = (connector: Connector, name: string) => {
    setStep('connecting');
    setSelectedWallet(name);
    connect({ connector });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-heading font-semibold">
            {showCreditCardOption ? 'Choose Payment Method' : 'Sign In'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'connecting' ? (
            <div className="text-center py-8">
              {isPending || !error ? (
                <>
                  <div className="animate-spin w-10 h-10 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-roots-gray">Connecting to {selectedWallet}...</p>
                  <p className="text-xs text-roots-gray mt-2">Check your wallet for a connection request</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium">Connection failed</p>
                  <p className="text-red-500 text-sm mt-2 break-words px-4">{error.message}</p>
                  <button
                    onClick={() => setStep('choice')}
                    className="mt-4 px-4 py-2 bg-roots-primary text-white rounded-lg hover:bg-roots-primary/90 text-sm"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-center text-roots-gray mb-6">
                {switchWallet && isConnected
                  ? 'Switch to a different wallet'
                  : showCreditCardOption
                    ? 'Choose how you\'d like to pay'
                    : 'Sign in to access your account'
                }
              </p>

              {/* Current wallet info and disconnect option - shown in switch mode */}
              {switchWallet && isConnected && address && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-roots-gray">Currently connected:</p>
                      <p className="font-mono text-sm">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        disconnect();
                        setWasConnectedOnOpen(false);
                      }}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Credit Card Option - shown at checkout */}
                {showCreditCardOption && onCreditCardSelect && (
                  <>
                    <button
                      onClick={() => {
                        onClose();
                        onCreditCardSelect();
                      }}
                      className="w-full p-4 rounded-lg border-2 border-roots-primary bg-roots-primary/5 hover:bg-roots-primary/10 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-roots-primary rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">Credit Card</div>
                          <div className="text-sm text-roots-gray">
                            Pay with Visa, Mastercard, or Apple Pay
                          </div>
                        </div>
                        <span className="text-xs bg-roots-primary/10 text-roots-primary px-2 py-1 rounded">
                          Recommended
                        </span>
                      </div>
                    </button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or use account balance</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Test Funds - for development/testing with pre-funded testnet tokens */}
                {testWalletConnector && (
                  <button
                    onClick={() => handleConnectWallet(testWalletConnector, 'Test Funds')}
                    disabled={isPending}
                    className="w-full p-4 rounded-lg border-2 border-green-500 bg-green-50 hover:bg-green-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Test Funds</div>
                        <div className="text-sm text-roots-gray">
                          Pre-funded testnet wallet for testing
                        </div>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Testnet
                      </span>
                    </div>
                  </button>
                )}

                {/* Browser Extension Wallet */}
                {hasInjectedWallet && injectedConnector && (
                  <button
                    onClick={() => handleConnectWallet(injectedConnector, 'Browser Wallet')}
                    disabled={isPending}
                    className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21.3 6.1L12 1 2.7 6.1 12 11.2l9.3-5.1zM2 7.7v8.6l9 5v-8.6l-9-5zM13 21.3l9-5V7.7l-9 5v8.6z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Browser Wallet</div>
                        <div className="text-sm text-roots-gray">
                          Connect your browser extension wallet
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* WalletConnect (Mobile Wallets) */}
                {walletConnectConnector && (
                  <button
                    onClick={() => handleConnectWallet(walletConnectConnector, 'WalletConnect')}
                    disabled={isPending}
                    className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">WalletConnect</div>
                        <div className="text-sm text-roots-gray">
                          Scan QR with mobile wallet app
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Coinbase Wallet */}
                {coinbaseConnector && (
                  <button
                    onClick={() => handleConnectWallet(coinbaseConnector, 'Coinbase Wallet')}
                    disabled={isPending}
                    className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-600 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Coinbase Wallet</div>
                        <div className="text-sm text-roots-gray">
                          Connect Coinbase Wallet app
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Login with Email - for credit card buyers to view orders */}
                {showPrivyOption && onPrivyLogin && (
                  <>
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">No crypto wallet?</span>
                      </div>
                    </div>
                    <button
                      onClick={onPrivyLogin}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">Sign In</div>
                          <div className="text-sm text-roots-gray">
                            Use Google, Apple, or email
                          </div>
                        </div>
                      </div>
                    </button>
                  </>
                )}

                {/* No wallet detected message */}
                {!hasInjectedWallet && !testWalletConnector && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="font-medium text-amber-800 text-sm mb-2">No browser wallet detected</p>
                    <p className="text-amber-700 text-xs">
                      <strong>On mobile:</strong> Use WalletConnect to scan a QR code with your wallet app.
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      <strong>On desktop:</strong> Install a browser wallet extension or use WalletConnect.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-roots-gray mt-6">
                {showCreditCardOption
                  ? 'Credit card payments are processed securely.'
                  : 'Sign in to view your account balance and earn Seeds rewards.'
                }
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
