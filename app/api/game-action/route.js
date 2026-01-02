import { NextResponse } from 'next/server';
import { getSessionId } from '../../../lib/session/cookieSession.js';
import { ServerGameController } from '../../../lib/game/serverGameController.js';

/**
 * POST /api/game-action
 * Process a game action (placeNumber, clearCell, startNewGame, keepPlaying, purchaseLife)
 * Body: { action: string, ...actionParams, expectedVersion?: number }
 */
export async function POST(request) {
  try {
    // Get session ID from cookie
    const sessionId = await getSessionId();

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found',
          errorCode: 'INVALID_SESSION'
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, expectedVersion } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Action is required',
          errorCode: 'INVALID_ACTION'
        },
        { status: 400 }
      );
    }

    // Process action
    const result = await ServerGameController.processAction(sessionId, body, expectedVersion ?? null);

    if (!result.success) {
      const statusCode = result.errorCode === 'VERSION_CONFLICT' ? 409 :
                        result.errorCode === 'INVALID_SESSION' ? 401 :
                        result.errorCode === 'GAME_NOT_FOUND' ? 404 : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[game-action] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'NETWORK_ERROR'
      },
      { status: 500 }
    );
  }
}



















