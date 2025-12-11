import { NextResponse } from 'next/server';
import { getPayment, hasPayment } from '../../../../lib/redis.js';

/**
 * Check if a payment exists in Redis
 * GET /api/payment/check?checkout-id=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get('checkout-id');

    if (!checkoutId) {
      return NextResponse.json(
        { error: 'checkout-id parameter is required' },
        { status: 400 }
      );
    }

    const payment = await getPayment(checkoutId);
    
    if (payment) {
      return NextResponse.json({
        exists: true,
        payment,
      });
    } else {
      return NextResponse.json({
        exists: false,
      });
    }
  } catch (error) {
    console.error('[payment/check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
