import { NextResponse } from 'next/server';
import { get, del } from '../../../lib/redis.js';

/**
 * API route to verify purchase
 * Checks for valid purchase token in Redis
 */
export async function POST(request) {
  try {
    const { checkoutId } = await request.json();
    
    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Checkout ID required' },
        { status: 400 }
      );
    }

    // Check if purchase token exists in Redis
    const purchaseKey = `purchase:${checkoutId}`;
    let purchaseTimestamp;
    
    try {
      purchaseTimestamp = await get(purchaseKey);
    } catch (redisError) {
      console.error('Redis error during purchase verification:', redisError);
      return NextResponse.json(
        { error: 'Failed to verify purchase. Please try again.' },
        { status: 500 }
      );
    }

    if (!purchaseTimestamp) {
      return NextResponse.json(
        { error: 'Invalid or expired purchase token. Payment may not have been verified yet.' },
        { status: 404 }
      );
    }

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
