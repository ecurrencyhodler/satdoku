import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { isCheckoutProcessed, markCheckoutProcessed } from '../../../../lib/redis/checkoutTracking.js';
import { incrementPaidConversations } from '../../../../lib/redis/tutorAnalytics.js';

/**
 * POST /api/tutor/payment
 * Process tutor chat payment and unlock conversation
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { checkoutId } = body;

    if (!checkoutId || typeof checkoutId !== 'string' || checkoutId.trim() === '') {
      return NextResponse.json(
        { error: 'Checkout ID is required' },
        { status: 400 }
      );
    }

    // Check idempotency - has this checkout already been processed?
    const alreadyProcessed = await isCheckoutProcessed(checkoutId);
    if (alreadyProcessed) {
      console.log('[tutor/payment] Checkout already processed:', checkoutId);
      // Still return success since payment was already processed
      // Get game state to return current paid conversations count
      const gameState = await getGameState(sessionId);
      const gameVersion = gameState?.version || 0;
      const { getPaidConversationsCount } = await import('../../../../lib/redis/tutorAnalytics.js');
      const paidCount = await getPaidConversationsCount(sessionId, gameVersion);
      
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        paidConversationsCount: paidCount
      });
    }

    // Get game state to determine game version
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.version) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 400 }
      );
    }

    const gameVersion = gameState.version;

    // Increment paid conversations count
    const result = await incrementPaidConversations(sessionId, gameVersion);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unlock conversation' },
        { status: 500 }
      );
    }

    // Mark checkout as processed
    await markCheckoutProcessed(checkoutId);
    console.log('[tutor/payment] Marked checkout as processed:', checkoutId);

    return NextResponse.json({
      success: true,
      paidConversationsCount: result.newCount
    });

  } catch (error) {
    console.error('[tutor/payment] Error processing payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


