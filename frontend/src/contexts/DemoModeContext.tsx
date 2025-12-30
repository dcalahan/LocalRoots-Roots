'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Demo wallet address (for display purposes)
const DEMO_WALLET_ADDRESS = '0xDemoWallet1234567890abcdef1234567890abcdef' as `0x${string}`;

// Demo balances
const DEMO_BALANCES = {
  ROOTS: BigInt(5000 * 10 ** 18), // 5000 ROOTS
  ETH: BigInt(0.5 * 10 ** 18),     // 0.5 ETH
  USDC: BigInt(100 * 10 ** 6),     // 100 USDC
};

interface DemoModeContextType {
  isDemoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  demoAddress: `0x${string}`;
  demoBalances: typeof DEMO_BALANCES;
  // Mock transaction functions
  simulatePurchase: (listingId: bigint, quantity: bigint, totalPrice: bigint) => Promise<{ success: boolean; orderId: bigint }>;
  simulateApproval: (amount: bigint) => Promise<boolean>;
  demoAllowance: bigint;
  setDemoAllowance: (amount: bigint) => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoAllowance, setDemoAllowance] = useState<bigint>(0n);
  const [nextOrderId, setNextOrderId] = useState(1000n);

  const enableDemoMode = useCallback(() => {
    setIsDemoMode(true);
    console.log('🧪 Demo Mode enabled - using simulated wallet');
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoMode(false);
    setDemoAllowance(0n);
    console.log('Demo Mode disabled');
  }, []);

  const simulateApproval = useCallback(async (amount: bigint): Promise<boolean> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setDemoAllowance(amount);
    console.log('🧪 Demo: Approved', amount.toString(), 'ROOTS');
    return true;
  }, []);

  const simulatePurchase = useCallback(async (
    listingId: bigint,
    quantity: bigint,
    totalPrice: bigint
  ): Promise<{ success: boolean; orderId: bigint }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const orderId = nextOrderId;
    setNextOrderId(prev => prev + 1n);

    console.log('🧪 Demo: Purchase completed', {
      listingId: listingId.toString(),
      quantity: quantity.toString(),
      totalPrice: totalPrice.toString(),
      orderId: orderId.toString(),
    });

    return { success: true, orderId };
  }, [nextOrderId]);

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        enableDemoMode,
        disableDemoMode,
        demoAddress: DEMO_WALLET_ADDRESS,
        demoBalances: DEMO_BALANCES,
        simulatePurchase,
        simulateApproval,
        demoAllowance,
        setDemoAllowance,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return context;
}

// Helper to check if demo mode should be available (development only)
export function isDemoModeAvailable(): boolean {
  return process.env.NODE_ENV === 'development';
}
