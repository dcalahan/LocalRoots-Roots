import { NextRequest, NextResponse } from 'next/server';

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;
const CROSSMINT_BASE_URL = process.env.NEXT_PUBLIC_CROSSMINT_ENVIRONMENT === 'production'
  ? 'https://www.crossmint.com/api'
  : 'https://staging.crossmint.com/api';

interface OrderItem {
  listingId: string;
  quantity: number;
  priceUsd: number;
  produceName: string;
  sellerName: string;
  isDelivery: boolean;
}

interface CreateOrderRequest {
  email: string;
  phone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  items: OrderItem[];
  totalUsd: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!CROSSMINT_API_KEY) {
      return NextResponse.json(
        { error: 'Crossmint API key not configured' },
        { status: 500 }
      );
    }

    const body: CreateOrderRequest = await request.json();
    const { email, phone, deliveryAddress, deliveryNotes, items, totalUsd } = body;

    // Validate required fields
    if (!email || !items?.length || !totalUsd) {
      return NextResponse.json(
        { error: 'Missing required fields: email, items, totalUsd' },
        { status: 400 }
      );
    }

    // Create line items description for Crossmint
    const lineItemsDescription = items
      .map(item => `${item.quantity}x ${item.produceName} from ${item.sellerName}`)
      .join(', ');

    // Create order with Crossmint Headless Checkout
    // This creates a payment intent that we can use to collect payment
    const crossmintResponse = await fetch(`${CROSSMINT_BASE_URL}/2022-06-09/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CROSSMINT_API_KEY,
      },
      body: JSON.stringify({
        // Payment configuration
        payment: {
          method: 'fiat',
          currency: 'usd',
          // For headless checkout, Crossmint handles the payment UI
        },
        // Line items for the order
        lineItems: {
          // Custom order - not NFT minting
          collectionLocator: 'crossmint:custom',
          callData: {
            // Metadata about the order
            description: `Local Roots Order: ${lineItemsDescription}`,
            // Store order details for reference
            metadata: {
              email,
              phone: phone || '',
              deliveryAddress: deliveryAddress || '',
              deliveryNotes: deliveryNotes || '',
              items: JSON.stringify(items),
              totalUsd,
              platform: 'localroots',
            },
          },
        },
        // Buyer info
        recipient: {
          email,
        },
        // Locale settings
        locale: 'en-US',
      }),
    });

    if (!crossmintResponse.ok) {
      const errorText = await crossmintResponse.text();
      console.error('[Crossmint] Order creation failed:', errorText);

      // Parse error for better messaging
      let errorMessage = 'Failed to create payment order';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // Use default message
      }

      return NextResponse.json(
        { error: errorMessage, details: errorText },
        { status: crossmintResponse.status }
      );
    }

    const orderData = await crossmintResponse.json();
    console.log('[Crossmint] Order created:', orderData);

    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      clientSecret: orderData.clientSecret,
      // Crossmint provides a hosted checkout URL for payment
      checkoutUrl: orderData.checkoutUrl,
      order: orderData,
    });

  } catch (error) {
    console.error('[Crossmint] Error creating order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
