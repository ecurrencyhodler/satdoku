import { NextResponse } from 'next/server';
import { storeGameState, getGameState, deleteGameState } from '../../../lib/redis.js';

/**
 * GET /api/game-state?session-id=xxx
 * Load game state from Redis
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session-id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session-id parameter is required' },
        { status: 400 }
      );
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
 * Save game state to Redis
 * Body: { sessionId: string, state: object, expectedVersion?: number }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, state, expectedVersion } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

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
 * DELETE /api/game-state?session-id=xxx
 * Delete game state from Redis
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session-id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session-id parameter is required' },
        { status: 400 }
      );
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
