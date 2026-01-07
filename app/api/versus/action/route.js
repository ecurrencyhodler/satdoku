import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { handleVersusPlaceNumber } from '../../../../lib/game/actionHandlers/versusPlaceNumber.js';
import { handleVersusToggleNote } from '../../../../lib/game/actionHandlers/versusToggleNote.js';
import { handleVersusSelectCell } from '../../../../lib/game/actionHandlers/versusSelectCell.js';
import { handleVersusPurchaseLife } from '../../../../lib/game/actionHandlers/versusPurchaseLife.js';
import { handleVersusClearNotes } from '../../../../lib/game/actionHandlers/versusClearNotes.js';

/**
 * POST /api/versus/action - Process game actions
 * Body: { action: string, roomId: string, ...actionParams }
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { action, roomId } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'placeNumber':
        result = await handleVersusPlaceNumber(roomId, sessionId, body);
        break;
      case 'toggleNote':
        result = await handleVersusToggleNote(roomId, sessionId, body);
        break;
      case 'selectCell':
        result = await handleVersusSelectCell(roomId, sessionId, body);
        break;
      case 'purchaseLife':
        result = await handleVersusPurchaseLife(roomId, sessionId, body);
        break;
      case 'clearNotes':
        result = await handleVersusClearNotes(roomId, sessionId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      const statusCode = result.errorCode === 'VERSION_CONFLICT' ? 409 :
                        result.errorCode === 'ROOM_NOT_FOUND' ? 404 :
                        result.errorCode === 'PLAYER_NOT_FOUND' ? 403 : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[versus/action] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

