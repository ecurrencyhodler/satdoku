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
      const gameId = gameState?.gameStartTime || null;
      const { getPaidConversationsCount } = await import('../../../../lib/redis/tutorAnalytics.js');
      const paidCount = await getPaidConversationsCount(sessionId, gameId);

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        paidConversationsCount: paidCount
      });
    }

    // Get game state to determine game identifier (required for keying)
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.gameStartTime) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 400 }
      );
    }

    // Use gameStartTime as stable game identifier (persists across moves)
    const gameId = gameState.gameStartTime;

    // Get current conversation count and paid count
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 500 }
      );
    }

    // Conversation count follows gameId (resets on new game)
    // Paid count does NOT follow gameId (persists across moves within same game)
    const countKey = `tutor_conversation_count:${sessionId}:${gameId}`;
    const paidKey = `tutor_chat_paid_conversations:${sessionId}`;

    // Get current counts
    const [countValue, paidValue] = await Promise.all([
      redis.get(countKey),
      redis.get(paidKey)
    ]);

    const conversationCount = countValue ? parseInt(countValue, 10) : 0;
    const currentPaidCount = paidValue ? parseInt(paidValue, 10) : 0;

    // Increment paidConversationsCount by 1
    // Each payment unlocks exactly ONE conversation
    // Don't use conversationCount in calculation to avoid unlocking multiple conversations
    const targetPaidCount = currentPaidCount + 1;
    
    // Set paid count to target (use setEx to ensure it's set correctly)
    await redis.setEx(paidKey, 90 * 24 * 60 * 60, targetPaidCount.toString());

    const result = { success: true, newCount: targetPaidCount };

    // Clear current conversation ID to enable a new conversation after payment
    clearCurrentConversationId(sessionId).catch(error => {
      console.error('[tutor/payment] Error clearing current conversation ID:', error);
      // Don't fail the request if this fails
    });

    // Track conversation purchase in Supabase - must complete before marking as processed
    // This ensures idempotency: if process crashes, checkout won't be marked processed
    // and can be retried safely
    const purchaseTracked = await trackConversationPurchase(checkoutId, sessionId, gameId, 'success');

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
