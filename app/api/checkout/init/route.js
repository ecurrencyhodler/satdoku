import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { storeCheckoutSession, getCheckoutSession } from '../../../../lib/redis/checkoutTracking.js';

/**
 * POST /api/checkout/init
 * Store checkoutId -> sessionId mapping when checkout is initiated
 * Body: { checkoutId: string }
 * 
 * NOTE: This endpoint is no longer needed for life purchases since we removed webhook processing.
 * Life purchases are now handled client-side via isCheckoutPaid from useCheckoutSuccess().
 * 
 * This endpoint is kept for backwards compatibility but may be removed in the future.
 */
export async function POST(request) {
  try {
    // Get session ID from cookie
    const sessionId = await getSessionId();
    
    if (!sessionId) {
      console.warn('[checkout/init] No session found - cannot store mapping');
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

    // Check if mapping already exists (idempotent)
    const existingSessionId = await getCheckoutSession(checkoutId);
    if (existingSessionId) {
      if (existingSessionId === sessionId) {
        // Same mapping already exists - that's fine
        console.log('[checkout/init] Mapping already exists for checkout:', checkoutId);
        return NextResponse.json({
          success: true,
          checkoutId,
          sessionId,
          alreadyExists: true
        });
      } else {
        // Different session - this is unusual but not necessarily an error
        // (could happen if user has multiple sessions)
        console.warn('[checkout/init] Mapping exists with different sessionId:', {
          checkoutId,
          existingSessionId,
          newSessionId: sessionId
        });
        // Still store the new mapping (overwrite)
      }
    }

    // Store the mapping
    const stored = await storeCheckoutSession(checkoutId, sessionId);
    
    if (!stored) {
      console.error('[checkout/init] Failed to store checkout session mapping:', { checkoutId, sessionId });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store checkout session',
          errorCode: 'STORAGE_ERROR'
        },
        { status: 500 }
      );
    }

    console.log('[checkout/init] Successfully stored checkout session mapping:', { checkoutId, sessionId });
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
