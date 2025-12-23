import { NextResponse } from 'next/server';
import { isCheckoutProcessed } from '../../../../lib/supabase/purchases.js';

/**
 * GET /api/checkout/status?checkout-id=xxx
 * Check if a checkout has been processed (life granted)
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

    const processed = await isCheckoutProcessed(checkoutId);

    return NextResponse.json({
      success: true,
      processed,
      checkoutId
    });
  } catch (error) {
    console.error('[checkout/status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}













