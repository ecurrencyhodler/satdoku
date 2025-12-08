import { NextResponse } from 'next/server';
import { get, del } from '@/lib/redis';

/**
 * API route to verify purchase
 * Checks for valid purchase token in Redis
 */
export async function POST(request) {
  try {
    const { checkoutId } = await request.json();
    
    console.log('[verify] Received verification request for checkoutId:', checkoutId);
    
    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Checkout ID required' },
        { status: 400 }
      );
    }

    // Check if purchase token exists in Redis
    const purchaseKey = `purchase:${checkoutId}`;
    console.log('[verify] Looking up key in Redis:', purchaseKey);
    
    let purchaseTimestamp;
    
    try {
      purchaseTimestamp = await get(purchaseKey);
      console.log('[verify] Redis lookup result:', purchaseTimestamp ? 'found' : 'not found');
    } catch (redisError) {
      console.error('[verify] Redis error during purchase verification:', redisError);
      return NextResponse.json(
        { error: 'Failed to verify purchase. Please try again.' },
        { status: 500 }
      );
    }

    if (!purchaseTimestamp) {
      console.log('[verify] Token not found for checkoutId:', checkoutId);
      return NextResponse.json(
        { error: 'Invalid or expired purchase token. Payment may not have been verified yet.' },
        { status: 404 }
      );
    }

    console.log('[verify] Purchase verified successfully for checkoutId:', checkoutId);

    // Don't delete token here - let client delete it after successfully granting life
    // This prevents token loss if life granting fails
    // Token will be deleted by client after successful life grant or will expire after 24 hours
    return NextResponse.json({ 
      success: true,
      message: 'Purchase verified',
      timestamp: purchaseTimestamp
    });
  } catch (error) {
    console.error('Purchase verification failed:', error);
    return NextResponse.json(
      { error: 'Failed to verify purchase' },
      { status: 500 }
    );
  }
}

/**
 * API route to delete purchase token after successful life grant
 */
export async function DELETE(request) {
  try {
    const { checkoutId } = await request.json();
    
    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Checkout ID required' },
        { status: 400 }
      );
    }

    // Delete the purchase token (one-time use)
    const purchaseKey = `purchase:${checkoutId}`;
    
    try {
      await del(purchaseKey);
      console.log(`Purchase token deleted for checkout: ${checkoutId}`);
    } catch (redisError) {
      // Log but don't fail - token will expire anyway
      console.error('Failed to delete purchase token from Redis:', redisError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Purchase token deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete purchase token:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase token' },
      { status: 500 }
    );
  }
}
