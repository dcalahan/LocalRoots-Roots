'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { CartItem, CartContextType, CartState } from '@/types/cart';

const CART_STORAGE_KEY = 'localroots_cart';

const CartContext = createContext<CartContextType | null>(null);

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];

    const state: CartState = JSON.parse(stored);
    return state.items || [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === 'undefined') return;

  const state: CartState = {
    items,
    lastUpdated: Date.now(),
  };

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    setItems(loadCartFromStorage());
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      saveCartToStorage(items);
    }
  }, [items, isHydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.listingId === item.listingId);

      if (existingIndex >= 0) {
        // Update quantity if item exists
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      // Add new item
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const updateQuantity = useCallback((listingId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.listingId !== listingId));
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.listingId === listingId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const clearSellerItems = useCallback((sellerId: string) => {
    setItems((prev) => prev.filter((i) => i.sellerId !== sellerId));
  }, []);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => {
      const price = BigInt(item.pricePerUnit);
      return sum + price * BigInt(item.quantity);
    }, 0n);
  }, [items]);

  const getSellerTotals = useCallback(() => {
    const sellerMap = new Map<string, { total: bigint; items: CartItem[] }>();

    for (const item of items) {
      const existing = sellerMap.get(item.sellerId) || { total: 0n, items: [] };
      const itemTotal = BigInt(item.pricePerUnit) * BigInt(item.quantity);

      sellerMap.set(item.sellerId, {
        total: existing.total + itemTotal,
        items: [...existing.items, item],
      });
    }

    return sellerMap;
  }, [items]);

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    clearSellerItems,
    getItemCount,
    getTotal,
    getSellerTotals,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
