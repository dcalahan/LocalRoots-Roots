export interface CartItem {
  listingId: string; // bigint serialized as string for localStorage
  sellerId: string;
  quantity: number;
  pricePerUnit: string; // bigint serialized as string
  isDelivery: boolean;
  metadata: {
    produceName: string;
    imageUrl: string | null;
    sellerName: string;
    unit: string;
  };
}

export interface CartState {
  items: CartItem[];
  lastUpdated: number;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  clearSellerItems: (sellerId: string) => void;
  getItemCount: () => number;
  getTotal: () => bigint;
  getSellerTotals: () => Map<string, { total: bigint; items: CartItem[] }>;
}
