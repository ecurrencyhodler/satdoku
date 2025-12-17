import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../../lib/session/cookieSession.js';
import { getRedisClient } from '../../../../../lib/redis/client.js';
import { getGameState } from '../../../../../lib/redis/gameState.js';

const CHAT_HISTORY_TTL = 90 * 24 * 60 * 60; // 90 days (matches game state)
const MAX_CONVERSATIONS_PER_GAME = 5;

/**
 * POST /api/tutor/chat-history/conversation-count
 * Increment conversation count for current game
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

    // Get current count
    const currentCountValue = await redis.get(countKey);
    const currentCount = currentCountValue ? parseInt(currentCountValue, 10) : 0;

    // Check if we've reached the limit
    if (currentCount >= MAX_CONVERSATIONS_PER_GAME) {
      return NextResponse.json({
        success: false,
        error: 'MAX_CONVERSATIONS_REACHED',
        message: 'Maximum conversations per game reached',
        conversationCount: currentCount
      });
    }

    // Increment count
    const newCount = currentCount + 1;
    await redis.setEx(countKey, CHAT_HISTORY_TTL, newCount.toString());

    return NextResponse.json({
      success: true,
      conversationCount: newCount
    });

  } catch (error) {
    console.error('[tutor/chat-history] POST conversation-count Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

