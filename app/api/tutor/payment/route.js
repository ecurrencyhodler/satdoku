import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { isCheckoutProcessed, trackConversationPurchase } from '../../../../lib/supabase/purchases.js';
import { incrementPaidConversations, clearCurrentConversationId } from '../../../../lib/redis/tutorAnalytics.js';

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
    // #region agent log
    console.log('[tutor/payment] Before incrementPaidConversations', { sessionId, gameVersion, checkoutId });
    // #endregion
    const result = await incrementPaidConversations(sessionId, gameVersion);
    // #region agent log
    console.log('[tutor/payment] After incrementPaidConversations', { success: result.success, newCount: result.newCount, error: result.error });
    // #endregion

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unlock conversation' },
        { status: 500 }
      );
    }

    // Clear current conversation ID to enable a new conversation after payment
    clearCurrentConversationId(sessionId).catch(error => {
      console.error('[tutor/payment] Error clearing current conversation ID:', error);
      // Don't fail the request if this fails
    });

    // Track conversation purchase in Supabase - must complete before marking as processed
    // This ensures idempotency: if process crashes, checkout won't be marked processed
    // and can be retried safely
    const purchaseTracked = await trackConversationPurchase(checkoutId, sessionId, gameVersion, 'success');

    if (!purchaseTracked) {
      // If tracking fails, log error but don't fail the request
      // The checkout won't be marked as processed, so it can be retried
      console.error('[tutor/payment] Failed to track conversation purchase in Supabase, but conversation was unlocked. Checkout can be retried.');
      // Note: We still return success since the conversation was unlocked
      // The tracking can be retried later
    } else {
      // Checkout is already marked as processed by trackConversationPurchase (it sets the cache)
      console.log('[tutor/payment] Conversation purchase tracked and checkout marked as processed:', checkoutId);
    }

    // #region agent log
    console.log('[tutor/payment] Returning success', { paidConversationsCount: result.newCount });
    // #endregion
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

