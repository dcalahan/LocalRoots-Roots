// Type declarations for window.ethereum (MetaMask and other EIP-1193 providers)

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isConnected?: () => boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
