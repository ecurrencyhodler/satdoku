import { NextResponse } from 'next/server';
import { getSessionIdIfExists } from '../../../../lib/session/cookieSession.js';
import { getRoom } from '../../../../lib/redis/versusRooms.js';
import { transformVersusStateToClient } from '../../../../lib/game/versusGameState.js';

/**
 * GET /api/versus/state?room=abc123 - Get current room state
 */
export async function GET(request) {
  try {
    const sessionId = await getSessionIdIfExists();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    // Determine player ID
    let playerId = null;
    if (sessionId) {
      if (room.players.player1?.sessionId === sessionId) {
        playerId = 'player1';
      } else if (room.players.player2?.sessionId === sessionId) {
        playerId = 'player2';
      }
    }

    // Transform to client format
    const clientState = transformVersusStateToClient(room, playerId);

    return NextResponse.json({
      success: true,
      state: clientState,
      room
    });
  } catch (error) {
    console.error('[versus/state] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

