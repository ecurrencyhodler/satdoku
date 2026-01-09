import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getRoom, setPlayerReady, updateRoomState } from '../../../../lib/supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../../../lib/websocket/broadcast.js';

/**
 * POST /api/versus/ready - Mark player as ready
 * Body: { roomId: string, ready: boolean }
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { roomId, ready } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Get room
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

    // Set ready status
    const result = await setPlayerReady(roomId, playerId, ready === true);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Check if both players are ready and game is waiting
    const updatedRoom = await getRoom(roomId);
    if (updatedRoom && 
        updatedRoom.status === 'waiting' &&
        updatedRoom.players.player1?.ready &&
        updatedRoom.players.player2?.ready &&
        !updatedRoom.start_at) {
      // Both players ready - set start_at and status to 'active'
      const startAt = new Date(Date.now() + 3000); // 3 seconds from now
      const roomWithStart = {
        ...updatedRoom,
        start_at: startAt.toISOString(),
        status: 'active'
      };
      
      const updateResult = await updateRoomState(roomId, roomWithStart, updatedRoom.version);
      
      if (updateResult.success) {
        // Get updated room with new start_at
        const finalRoom = await getRoom(roomId);
        
        // Broadcast countdown_start message
        broadcastToWebSocket(roomId, {
          type: 'countdown_start',
          start_at: finalRoom.start_at,
          room: finalRoom
        });
        
        return NextResponse.json({
          success: true,
          bothReady: true,
          room: finalRoom
        });
      }
    }

    return NextResponse.json({
      success: true,
      bothReady: false,
      room: updatedRoom
    });
  } catch (error) {
    console.error('[versus/ready] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

