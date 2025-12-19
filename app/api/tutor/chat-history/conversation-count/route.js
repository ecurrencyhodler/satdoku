import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../../lib/session/cookieSession.js';
import { getRedisClient } from '../../../../../lib/redis/client.js';
import { getGameState } from '../../../../../lib/redis/gameState.js';
import { trackConversationOpened, getPaidConversationsCount, canStartConversationWithoutPayment } from '../../../../../lib/redis/tutorAnalytics.js';

const CHAT_HISTORY_TTL = 90 * 24 * 60 * 60; // 90 days (matches game state)

/**
 * POST /api/tutor/chat-history/conversation-count
 * Check if user can start a conversation (payment check only, no increment)
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

    // Get game state to determine game version
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.version) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 400 }
      );
    }

    const gameVersion = gameState.version;
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutor/chat-history] Redis not available');
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 500 }
      );
    }

    const countKey = `tutor_conversation_count:${sessionId}:${gameVersion}`;

    // Get current count (don't increment - that happens when conversation completes)
    const currentCountValue = await redis.get(countKey);
    const currentCount = currentCountValue ? parseInt(currentCountValue, 10) : 0;

    // Check if payment is required
    const canStartWithoutPayment = await canStartConversationWithoutPayment(sessionId, gameVersion);
    const paidConversationsCount = await getPaidConversationsCount(sessionId, gameVersion);

    if (!canStartWithoutPayment) {
      return NextResponse.json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: 'Payment required to start a new conversation',
        conversationCount: currentCount,
        paidConversationsCount: paidConversationsCount,
        requiresPayment: true
      });
    }

    // Track conversation opened for analytics (non-blocking)
    trackConversationOpened(sessionId, gameVersion).catch(error => {
      console.error('[tutor/chat-history] Error tracking conversation analytics:', error);
      // Don't fail the request if analytics tracking fails
    });

    return NextResponse.json({
      success: true,
      conversationCount: currentCount,
      paidConversationsCount: paidConversationsCount,
      requiresPayment: false
    });

  } catch (error) {
    console.error('[tutor/chat-history] POST conversation-count Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tutor/chat-history/conversation-count
 * Increment conversation count when conversation completes (5 user messages)
 */
export async function PUT(request) {
  try {
    const sessionId = await getSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
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
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutor/chat-history] Redis not available');
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 500 }
      );
    }

    const countKey = `tutor_conversation_count:${sessionId}:${gameVersion}`;

    // Get current count
    const currentCountValue = await redis.get(countKey);
    const currentCount = currentCountValue ? parseInt(currentCountValue, 10) : 0;

    // Increment count (conversation completed)
    const newCount = currentCount + 1;
    await redis.setEx(countKey, CHAT_HISTORY_TTL, newCount.toString());

    const paidConversationsCount = await getPaidConversationsCount(sessionId, gameVersion);

    return NextResponse.json({
      success: true,
      conversationCount: newCount,
      paidConversationsCount: paidConversationsCount
    });

  } catch (error) {
    console.error('[tutor/chat-history] PUT conversation-count Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}








