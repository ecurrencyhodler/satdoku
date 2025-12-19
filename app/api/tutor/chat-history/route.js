import { NextResponse } from 'next/server';
import { getSessionId, getSessionIdIfExists } from '../../../../lib/session/cookieSession.js';
import { getRedisClient } from '../../../../lib/redis/client.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { trackMessage, getCurrentConversationId, getPaidConversationsCount, canStartConversationWithoutPayment } from '../../../../lib/redis/tutorAnalytics.js';

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

    // Get game state to determine game version
    const gameState = await getGameState(sessionId);
    const gameVersion = gameState?.version || 0;

    const key = `tutor_chat:${sessionId}`;
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

    const key = `tutor_chat:${sessionId}`;

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
 * Clear chat history for current session
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

    const key = `tutor_chat:${sessionId}`;
    await redis.del(key);

    // Also clear conversation count for all game versions
    // Get game state to find current version
    const gameState = await getGameState(sessionId);
    if (gameState?.version) {
      const countKey = `tutor_conversation_count:${sessionId}:${gameState.version}`;
      await redis.del(countKey);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[tutor/chat-history] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









