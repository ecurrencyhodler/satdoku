import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { getRedisClient } from '../../../../lib/redis/client.js';
import { isCheckoutProcessed, trackConversationPurchase } from '../../../../lib/supabase/purchases.js';
import { clearCurrentConversationId } from '../../../../lib/redis/tutorAnalytics.js';

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

    // Get current conversation count and paid count
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 500 }
      );
    }

    const countKey = `tutor_conversation_count:${sessionId}:${gameVersion}`;
    const paidKey = `tutor_chat_paid_conversations:${sessionId}:${gameVersion}`;

    // Get current counts
    const [countValue, paidValue] = await Promise.all([
      redis.get(countKey),
      redis.get(paidKey)
    ]);

    const conversationCount = countValue ? parseInt(countValue, 10) : 0;
    const currentPaidCount = paidValue ? parseInt(paidValue, 10) : 0;

    // #region agent log
    console.log('[tutor/payment] Before payment processing', { sessionId, gameVersion, checkoutId, conversationCount, currentPaidCount });
    // #endregion

    // Ensure paidConversationsCount is at least equal to conversationCount
    // This fixes the issue where conversationCount increments after payment
    // If conversationCount is 2 and paidCount is 1, we need to set paidCount to 2
    const targetPaidCount = Math.max(conversationCount, currentPaidCount + 1);
    
    // Set paid count to target (use setEx to ensure it's set correctly)
    await redis.setEx(paidKey, 90 * 24 * 60 * 60, targetPaidCount.toString());

    // #region agent log
    console.log('[tutor/payment] After payment processing', { conversationCount, currentPaidCount, targetPaidCount });
    // #endregion

    const result = { success: true, newCount: targetPaidCount };

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

