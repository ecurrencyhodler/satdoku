import { NextResponse } from 'next/server';
import { getSessionId, getSessionIdIfExists } from '../../../../lib/session/cookieSession.js';
import { getRedisClient } from '../../../../lib/redis/client.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { trackMessage, getCurrentConversationId, getPaidConversationsCount, canStartConversationWithoutPayment, clearCurrentConversationId } from '../../../../lib/redis/tutorAnalytics.js';

const CHAT_HISTORY_TTL = 90 * 24 * 60 * 60; // 90 days (matches game state)

/**
 * GET /api/tutor/chat-history
 * Retrieve chat history and conversation count for current session
 */
export async function GET(request) {
  try {
    const sessionId = await getSessionIdIfExists();

    if (!sessionId) {
      return NextResponse.json({ success: true, history: [], conversationCount: 0 });
    }

    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutor/chat-history] Redis not available');
      return NextResponse.json({ success: true, history: [], conversationCount: 0 });
    }

    // Get game state to determine game version (required for keying)
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.version) {
      // If no game state, return empty history (user needs to start a game first)
      return NextResponse.json({ success: true, history: [], conversationCount: 0, paidConversationsCount: 0, requiresPayment: false });
    }

    const gameVersion = gameState.version;

    // Chat follows gameVersion - key includes gameVersion so chat resets on new game
    const key = `tutor_chat:${sessionId}:${gameVersion}`;
    const countKey = `tutor_conversation_count:${sessionId}:${gameVersion}`;

    // Get both history and conversation count
    const [value, countValue] = await Promise.all([
      redis.get(key),
      redis.get(countKey)
    ]);

    let history = [];
    if (value) {
      try {
        history = JSON.parse(value);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.error('[tutor/chat-history] Failed to parse chat history:', parseError);
        history = [];
      }
    }

    const conversationCount = countValue ? parseInt(countValue, 10) : 0;

    // Get payment status
    const paidConversationsCount = await getPaidConversationsCount(sessionId, gameVersion);
    const canStartWithoutPayment = await canStartConversationWithoutPayment(sessionId, gameVersion);
    const requiresPayment = !canStartWithoutPayment && conversationCount > 0;

    // #region agent log
    console.log('[tutor/chat-history] GET response data', { 
      conversationCount, 
      paidConversationsCount, 
      canStartWithoutPayment, 
      requiresPayment,
      gameVersion 
    });
    // #endregion

    return NextResponse.json({
      success: true,
      history: history,
      conversationCount: conversationCount,
      paidConversationsCount: paidConversationsCount,
      requiresPayment: requiresPayment
    });

  } catch (error) {
    console.error('[tutor/chat-history] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tutor/chat-history
 * Save a chat message to history
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
    const { role, content } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 }
      );
    }

    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { error: 'role must be "user" or "assistant"' },
        { status: 400 }
      );
    }

    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutor/chat-history] Redis not available');
      return NextResponse.json(
        { error: 'Storage not available' },
        { status: 500 }
      );
    }

    // Get game state to determine game version (required for keying)
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.version) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 400 }
      );
    }

    const gameVersion = gameState.version;

    // Chat follows gameVersion - key includes gameVersion so chat resets on new game
    const key = `tutor_chat:${sessionId}:${gameVersion}`;

    // Get existing history
    const existingValue = await redis.get(key);
    let history = [];

    if (existingValue) {
      try {
        history = JSON.parse(existingValue);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.warn('[tutor/chat-history] Failed to parse existing history, starting fresh');
        history = [];
      }
    }

    // Add new message
    history.push({
      role: role,
      content: content,
      timestamp: new Date().toISOString()
    });

    // Save back to Redis with TTL
    await redis.setEx(key, CHAT_HISTORY_TTL, JSON.stringify(history));

    // Track message for analytics (non-blocking)
    // Get current conversation ID for this session
    getCurrentConversationId(sessionId).then(conversationId => {
      if (conversationId) {
        return trackMessage(conversationId, sessionId, role);
      }
      return null;
    }).catch(error => {
      console.error('[tutor/chat-history] Error tracking message analytics:', error);
      // Don't fail the request if analytics tracking fails
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[tutor/chat-history] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tutor/chat-history
 * Clear chat history for current game version
 * NOTE: Chat follows gameVersion - conversation count, paid count, and chat history
 * are all keyed by sessionId:gameVersion, so they reset on new game.
 * This endpoint clears the chat history when a new game starts.
 */
export async function DELETE(request) {
  try {
    const sessionId = await getSessionIdIfExists();

    if (!sessionId) {
      return NextResponse.json({ success: true });
    }

    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutor/chat-history] Redis not available');
      return NextResponse.json({ success: true });
    }

    // Get game state to determine game version (required for keying)
    const gameState = await getGameState(sessionId);
    if (!gameState || !gameState.version) {
      // If no game state, nothing to clear
      return NextResponse.json({ success: true });
    }

    const gameVersion = gameState.version;

    // Chat follows gameVersion - key includes gameVersion so chat resets on new game
    const key = `tutor_chat:${sessionId}:${gameVersion}`;
    await redis.del(key);

    // Also clear conversation count and paid count for this game version
    const countKey = `tutor_conversation_count:${sessionId}:${gameVersion}`;
    const paidKey = `tutor_chat_paid_conversations:${sessionId}:${gameVersion}`;
    await Promise.all([
      redis.del(countKey),
      redis.del(paidKey)
    ]);

    // Clear current conversation ID when chat history is cleared (new game started)
    // This enables a new conversation to be started for the new game
    clearCurrentConversationId(sessionId).catch(error => {
      console.error('[tutor/chat-history] Error clearing current conversation ID:', error);
      // Don't fail the request if this fails
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[tutor/chat-history] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









