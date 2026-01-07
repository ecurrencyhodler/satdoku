import { NextResponse } from 'next/server';
import { getSessionId } from '../../../lib/session/cookieSession.js';
import { updatePlayerName } from '../../../lib/redis/versusRooms.js';

/**
 * POST /api/versus/name - Update player name
 * Body: { roomId: string, name: string }
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { roomId, name } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Get room to determine player ID
    const { getRoom } = await import('../../../lib/redis/versusRooms.js');
    const room = await getRoom(roomId);
    
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    // Determine which player this is
    let playerId = null;
    if (room.players.player1?.sessionId === sessionId) {
      playerId = 'player1';
    } else if (room.players.player2?.sessionId === sessionId) {
      playerId = 'player2';
    } else {
      return NextResponse.json(
        { success: false, error: 'Player not found in room' },
        { status: 403 }
      );
    }

    // Update name
    const result = await updatePlayerName(roomId, playerId, name.trim());
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('[versus/name] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

