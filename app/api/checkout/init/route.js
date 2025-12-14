import { NextResponse } from 'next/server';
import { getSessionId } from '../../../lib/session/cookieSession.js';
import { storeCheckoutSession } from '../../../lib/redis/checkoutTracking.js';

/**
 * POST /api/checkout/init
 * Store checkoutId -> sessionId mapping when checkout is initiated
 * Body: { checkoutId: string }
 */
export async function POST(request) {
  try {
    // Get session ID from cookie
    const sessionId = await getSessionId();
    
    if (!sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Session not found',
          errorCode: 'INVALID_SESSION'
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { checkoutId } = body;

    if (!checkoutId || typeof checkoutId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'checkoutId is required',
          errorCode: 'INVALID_CHECKOUT_ID'
        },
        { status: 400 }
      );
    }

    // Store the mapping
    const stored = await storeCheckoutSession(checkoutId, sessionId);
    
    if (!stored) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store checkout session',
          errorCode: 'STORAGE_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutId,
      sessionId
    });
  } catch (error) {
    console.error('[checkout/init] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'NETWORK_ERROR'
      },
      { status: 500 }
    );
  }
}