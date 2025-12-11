import { NextResponse } from 'next/server';

/**
 * Check if a payment exists
 * GET /api/payment/check?checkout-id=xxx
 * Note: Payment data is no longer stored in Redis
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

    // Payment data is no longer stored in Redis
    return NextResponse.json({
      exists: false,
      message: 'Payment data is no longer stored in Redis',
    });
  } catch (error) {
    console.error('[payment/check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
