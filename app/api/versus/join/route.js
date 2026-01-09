import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { joinRoom, getRoom } from '../../../../lib/supabase/versusRooms.js';

/**
 * POST /api/versus/join - Join a room as player 2
 * Body: { roomId: string, playerName?: string }
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { roomId, playerName } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Join room
    const result = await joinRoom(roomId, sessionId, playerName || 'Player 2');
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get updated room
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    // Determine player ID
    let playerId = null;
    if (room.players.player1?.sessionId === sessionId) {
      playerId = 'player1';
    } else if (room.players.player2?.sessionId === sessionId) {
      playerId = 'player2';
    }

    return NextResponse.json({
      success: true,
      playerId: playerId || (result.isSpectator ? null : 'player2'),
      isSpectator: result.isSpectator || false,
      room
    });
  } catch (error) {
    console.error('[versus/join] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
