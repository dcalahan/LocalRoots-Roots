'use client';

import { useState, useEffect } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';
import type { Connector } from 'wagmi';
import { isTestWalletAvailable } from '@/lib/testWalletConnector';

// Storage key for preserving path during wallet connection
const WALLET_CONNECT_RETURN_PATH = 'localroots_wallet_return_path';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = 'choice' | 'new-user-guide' | 'connecting';

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { isConnected } = useAccount();
  const [step, setStep] = useState<ModalStep>('choice');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // On connection success, redirect to stored path if different from current
  useEffect(() => {
    if (isConnected) {
      const returnPath = sessionStorage.getItem(WALLET_CONNECT_RETURN_PATH);
      if (returnPath && returnPath !== pathname) {
        sessionStorage.removeItem(WALLET_CONNECT_RETURN_PATH);
        router.push(returnPath);
      }
      if (isOpen) {
        onClose();
      }
    }
  }, [isConnected, isOpen, onClose, pathname, router]);

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setSelectedWallet(null);
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  // Find WalletConnect connector (for mobile wallets)
  const walletConnectConnector = connectors.find(
    (c) => c.id === 'walletConnect'
  );

  // Find Coinbase/Base Wallet connector
  const baseWalletConnector = connectors.find(
    (c) => c.id === 'coinbaseWalletSDK' || c.name.includes('Coinbase')
  );

  // Find injected wallet (MetaMask, Trust Wallet extension, etc.)
  const injectedConnector = connectors.find(
    (c) => c.id === 'injected'
  );

  // Find test wallet connector (development only)
  const testWalletConnectorInstance = connectors.find(
    (c) => c.id === 'testWallet'
  );

  // Check if injected wallet is actually available (has a real provider)
  const hasInjectedWallet = typeof window !== 'undefined' &&
    (window.ethereum !== undefined || (window as any).web3 !== undefined);

  const handleConnectWallet = (connector: Connector, name: string) => {
    console.log('Attempting to connect with:', connector.id, connector.name);
    // Store current path so we can return here after mobile wallet redirect
    sessionStorage.setItem(WALLET_CONNECT_RETURN_PATH, pathname);
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
          <h2 className="text-lg font-heading font-semibold">Connect Wallet</h2>
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
                  {error.message?.includes('rejected') && (
                    <p className="text-gray-500 text-xs mt-2">You declined the connection request in your wallet.</p>
                  )}
                  {error.message?.includes('not installed') && (
                    <p className="text-gray-500 text-xs mt-2">Please install the wallet app first.</p>
                  )}
                  {(error.message?.toLowerCase().includes('smart wallet') ||
                    error.message?.toLowerCase().includes('recovery phrase')) && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg text-left">
                      <p className="text-amber-800 text-xs font-medium mb-1">Smart Wallet Not Supported</p>
                      <p className="text-amber-700 text-xs">
                        Base/Coinbase Wallet's new "Smart Wallet" feature isn't compatible yet.
                        Try using <strong>Mobile Wallet</strong> (WalletConnect) with MetaMask or Trust Wallet instead.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setStep('choice')}
                    className="mt-4 px-4 py-2 bg-roots-primary text-white rounded-lg hover:bg-roots-primary/90 text-sm"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : step === 'new-user-guide' ? (
            /* New User Education Screen */
            <div className="space-y-4">
              <button
                onClick={() => setStep('choice')}
                className="text-roots-gray hover:text-roots-primary text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="text-center">
                <div className="text-4xl mb-3">🔐</div>
                <h3 className="font-semibold text-lg mb-2">What is a Digital Wallet?</h3>
                <p className="text-sm text-roots-gray">
                  A digital wallet is like a secure app on your phone that holds your money for online purchases.
                  It keeps your $ROOTS tokens safe and lets you buy produce from local sellers.
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-sm">Popular wallet apps:</p>
                <ul className="text-sm text-roots-gray space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <strong>MetaMask</strong> - Most popular Web3 wallet
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <strong>Trust Wallet</strong> - Easy to use, many features
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <strong>Coinbase Wallet</strong> - Great for beginners
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Download a wallet:</p>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 flex flex-col items-center gap-1 transition-colors"
                  >
                    <div className="w-8 h-8 bg-orange-500 rounded-lg"></div>
                    <span className="text-xs">MetaMask</span>
                  </a>
                  <a
                    href="https://trustwallet.com/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center gap-1 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-500 rounded-lg"></div>
                    <span className="text-xs">Trust</span>
                  </a>
                  <a
                    href="https://www.coinbase.com/wallet/downloads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border-2 border-gray-200 hover:border-blue-600 hover:bg-blue-50 flex flex-col items-center gap-1 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                    <span className="text-xs">Coinbase</span>
                  </a>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-center text-roots-gray">
                  After downloading, come back and tap "Mobile Wallet" to connect.
                </p>
              </div>
            </div>
          ) : (
            /* Main Choice Screen */
            <>
              <p className="text-center text-roots-gray mb-6">
                Connect a wallet to buy and sell on Local Roots.
              </p>

              <div className="space-y-3">
                {/* New User - Learn about wallets */}
                <button
                  onClick={() => setStep('new-user-guide')}
                  className="w-full p-4 rounded-lg border-2 border-roots-primary bg-roots-primary/5 hover:bg-roots-primary/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-roots-primary rounded-lg flex items-center justify-center text-xl">
                      🆕
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">New to crypto?</div>
                      <div className="text-sm text-roots-gray">
                        Learn what a wallet is & get started
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-roots-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Test Wallet - Development Only */}
                {testWalletConnectorInstance && isTestWalletAvailable() && (
                  <>
                    <button
                      onClick={() => handleConnectWallet(testWalletConnectorInstance, 'Test Wallet')}
                      disabled={isPending}
                      className="w-full p-4 rounded-lg border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-xl">
                          🧪
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-800">Test Wallet (Dev)</div>
                          <div className="text-sm text-amber-600">
                            Pre-funded wallet on Base Sepolia
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or use your own wallet</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Divider - only show if no test wallet */}
                {!testWalletConnectorInstance && (
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">I have a wallet</span>
                    </div>
                  </div>
                )}

                {/* Browser Extension Wallet (MetaMask, etc.) - only show if actually detected */}
                {hasInjectedWallet && injectedConnector && (
                  <button
                    onClick={() => handleConnectWallet(injectedConnector, 'Browser Wallet')}
                    disabled={isPending}
                    className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Wallet Detected</div>
                        <div className="text-sm text-roots-gray">
                          MetaMask or other browser wallet
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* WalletConnect for mobile wallets */}
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
                        <div className="font-semibold">Mobile Wallet</div>
                        <div className="text-sm text-roots-gray">
                          MetaMask, Trust & others via WalletConnect
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Base (Coinbase) Wallet */}
                {baseWalletConnector && (
                  <button
                    onClick={() => handleConnectWallet(baseWalletConnector, 'Base Wallet')}
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
                        <div className="font-semibold">Base Wallet</div>
                        <div className="text-sm text-roots-gray">
                          EOA wallets only (Smart Wallet not supported)
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* No wallet detected - show instructions */}
                {!hasInjectedWallet && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="font-medium text-amber-800 text-sm mb-2">No browser wallet detected</p>
                    <p className="text-amber-700 text-xs">
                      <strong>On mobile:</strong> Open this site in your wallet app's browser.
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      <strong>On desktop:</strong> Install MetaMask or another browser extension.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-roots-gray mt-6">
                Wallets securely hold your $ROOTS tokens. No personal info required.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
