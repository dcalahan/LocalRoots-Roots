/**
 * Push Notification Service for LocalRoots
 *
 * This provides the client-side infrastructure for push notifications.
 * In production, you would need:
 * 1. A backend service (e.g., Firebase Cloud Messaging, OneSignal, or custom)
 * 2. A service worker to handle push events
 * 3. VAPID keys for web push authentication
 */

export type NotificationType =
  | 'order_placed'
  | 'order_ready_pickup'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_completed'
  | 'dispute_raised'
  | 'dispute_resolved';

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Check if service workers are supported
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

// Show a local notification (for testing/demo purposes)
export function showLocalNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    console.log('Notification (not shown - permission not granted):', payload);
    return;
  }

  new Notification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.type,
    data: payload.data,
  });
}

// Subscribe to push notifications (stub - needs backend implementation)
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!isServiceWorkerSupported()) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // In production, you would use your VAPID public key here
    // const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    // For now, just log that we would subscribe
    console.log('Push subscription would be created here with service worker:', registration);

    // Actual implementation would look like:
    // const subscription = await registration.pushManager.subscribe({
    //   userVisibleOnly: true,
    //   applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    // });
    // return subscription;

    return null;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

// Notification templates for different order events
export function getOrderNotification(
  type: NotificationType,
  orderDetails: { orderId: string; productName?: string; sellerName?: string }
): NotificationPayload {
  switch (type) {
    case 'order_placed':
      return {
        type,
        title: 'Order Confirmed!',
        body: `Your order #${orderDetails.orderId} has been placed with ${orderDetails.sellerName}.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'order_ready_pickup':
      return {
        type,
        title: 'Ready for Pickup!',
        body: `Your ${orderDetails.productName} is ready for pickup from ${orderDetails.sellerName}.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'order_out_for_delivery':
      return {
        type,
        title: 'Out for Delivery!',
        body: `Your ${orderDetails.productName} is on its way from ${orderDetails.sellerName}.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'order_delivered':
      return {
        type,
        title: 'Order Delivered!',
        body: `Your ${orderDetails.productName} from ${orderDetails.sellerName} has been delivered. Enjoy your fresh produce!`,
        data: { orderId: orderDetails.orderId },
      };
    case 'order_completed':
      return {
        type,
        title: 'Order Complete',
        body: `Order #${orderDetails.orderId} has been completed. Thanks for shopping local!`,
        data: { orderId: orderDetails.orderId },
      };
    case 'dispute_raised':
      return {
        type,
        title: 'Dispute Filed',
        body: `A dispute has been raised for order #${orderDetails.orderId}. We'll help resolve this.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'dispute_resolved':
      return {
        type,
        title: 'Dispute Resolved',
        body: `The dispute for order #${orderDetails.orderId} has been resolved.`,
        data: { orderId: orderDetails.orderId },
      };
    default:
      return {
        type: 'order_placed',
        title: 'LocalRoots Update',
        body: 'You have a new notification.',
        data: { orderId: orderDetails.orderId },
      };
  }
}

// Seller notification templates
export function getSellerNotification(
  type: 'new_order' | 'order_completed' | 'dispute_raised',
  orderDetails: { orderId: string; buyerAddress?: string; productName?: string }
): NotificationPayload {
  switch (type) {
    case 'new_order':
      return {
        type: 'order_placed',
        title: 'New Order!',
        body: `You have a new order #${orderDetails.orderId} for ${orderDetails.productName}.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'order_completed':
      return {
        type: 'order_completed',
        title: 'Order Completed',
        body: `Order #${orderDetails.orderId} has been marked as complete by the buyer.`,
        data: { orderId: orderDetails.orderId },
      };
    case 'dispute_raised':
      return {
        type: 'dispute_raised',
        title: 'Dispute Filed',
        body: `The buyer has raised a dispute for order #${orderDetails.orderId}.`,
        data: { orderId: orderDetails.orderId },
      };
    default:
      return {
        type: 'order_placed',
        title: 'LocalRoots Update',
        body: 'You have a new notification.',
        data: { orderId: orderDetails.orderId },
      };
  }
}
