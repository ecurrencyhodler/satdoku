import { NextResponse } from 'next/server';
import { storeGameState, getGameState, deleteGameState } from '../../../lib/redis/gameState.js';
import { getSessionIdIfExists } from '../../../lib/session/cookieSession.js';

/**
 * GET /api/game-state
 * Load game state from Redis (session derived from cookie)
 */
export async function GET(request) {
  try {
    const sessionId = await getSessionIdIfExists();

    if (!sessionId) {
      return NextResponse.json({ success: true, state: null });
    }

    const gameState = await getGameState(sessionId);

    if (gameState) {
      // Remove internal metadata before returning, but keep version
      const { storedAt, version, ...state } = gameState;
      return NextResponse.json({
        success: true,
        state: { ...state, version: version || 0 }
      });
    } else {
      return NextResponse.json({ success: true, state: null });
    }
  } catch (error) {
    console.error('[game-state] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/game-state
 * Save game state to Redis (deprecated - use /api/game-action instead)
 * Body: { state: object, expectedVersion?: number }
 * Session derived from cookie
 */
export async function POST(request) {
  try {
    const { getSessionId } = await import('../../../lib/session/cookieSession.js');
    const sessionId = await getSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { state, expectedVersion } = body;

    if (!state) {
      return NextResponse.json(
        { error: 'state is required' },
        { status: 400 }
      );
    }

    const result = await storeGameState(sessionId, state, expectedVersion ?? null);

    if (result.success) {
      return NextResponse.json({
        success: true,
        version: result.version
      });
    } else if (result.conflict) {
      return NextResponse.json(
        { error: 'Version conflict - state was modified by another operation', conflict: true },
        { status: 409 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to save game state' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[game-state] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/game-state
 * Delete game state from Redis (session derived from cookie)
 */
export async function DELETE(request) {
  try {
    const { getSessionIdIfExists } = await import('../../../lib/session/cookieSession.js');
    const sessionId = await getSessionIdIfExists();

    if (!sessionId) {
      return NextResponse.json({ success: true });
    }

    const success = await deleteGameState(sessionId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete game state' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[game-state] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}











