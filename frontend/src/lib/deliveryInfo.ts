// Temporary client-side storage for delivery addresses
// TODO: This should be moved to smart contract storage for production

const DELIVERY_INFO_KEY = 'localroots_delivery_info';

export interface DeliveryInfo {
  address: string;
  notes?: string;
  phone?: string;
  savedAt: number;
}

// Store delivery info keyed by orderId
export function saveDeliveryInfo(orderId: string, info: DeliveryInfo): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(DELIVERY_INFO_KEY);
    const data: Record<string, DeliveryInfo> = stored ? JSON.parse(stored) : {};
    data[orderId] = info;
    localStorage.setItem(DELIVERY_INFO_KEY, JSON.stringify(data));
    console.log('[deliveryInfo] Saved for order', orderId, '- all stored:', Object.keys(data));
  } catch (err) {
    console.error('Failed to save delivery info:', err);
  }
}

// Get delivery info for an order
export function getDeliveryInfo(orderId: string): DeliveryInfo | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(DELIVERY_INFO_KEY);
    if (!stored) return null;
    const data: Record<string, DeliveryInfo> = JSON.parse(stored);
    return data[orderId] || null;
  } catch {
    return null;
  }
}

// Get all delivery info (for sellers to check)
export function getAllDeliveryInfo(): Record<string, DeliveryInfo> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(DELIVERY_INFO_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}
