import { NextResponse } from 'next/server';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getRoom, setPlayerReady, updateRoomState, setStartAtIfNull } from '../../../../lib/supabase/versusRooms.js';
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
      // Fallback: If player2 exists but sessionId doesn't match, and player1 exists,
      // this might be a cookie mismatch issue. Try to update player2's sessionId to match.
      // This handles the case where the cookie changed between join and ready.
      if (room.players.player2 && room.players.player1 && room.players.player1.sessionId !== sessionId) {
        // Update player2's sessionId to match the current cookie
        room.players.player2.sessionId = sessionId;
        const updateResult = await updateRoomState(roomId, room, room.version);
        if (updateResult.success) {
          playerId = 'player2';
        } else {
          return NextResponse.json(
            { success: false, error: 'Player not found in room' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Player not found in room' },
          { status: 403 }
        );
      }
    }

    // Set ready status
    const result = await setPlayerReady(roomId, playerId, ready === true);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Get updated room after ready status change
    const updatedRoom = await getRoom(roomId);
    
    // Broadcast minimal notification - clients will fetch full state from Postgres
    broadcastToWebSocket(roomId, {
      type: 'state_update'
    });

    // Check if both players are ready and game is waiting
    if (updatedRoom && 
        updatedRoom.status === 'waiting' &&
        updatedRoom.players.player1?.ready &&
        updatedRoom.players.player2?.ready) {
      // Both players ready - atomically set start_at (only if NULL)
      // This ensures start_at is set exactly once, even if both players click ready simultaneously
      const startAtResult = await setStartAtIfNull(roomId);
      
      if (startAtResult.success && startAtResult.set) {
        // We successfully set start_at - get updated room and broadcast
        const finalRoom = await getRoom(roomId);
        
        // Broadcast countdown_start - start_at will come from Postgres subscription
        // Clients will fetch full state from Postgres when they receive this
        broadcastToWebSocket(roomId, {
          type: 'countdown_start'
        });
        // Also broadcast state_update to trigger Postgres fetch
        broadcastToWebSocket(roomId, {
          type: 'state_update'
        });
        
        return NextResponse.json({
          success: true,
          bothReady: true,
          room: finalRoom
        });
      } else if (startAtResult.success && !startAtResult.set && startAtResult.start_at) {
        // start_at was already set by another request - still broadcast to ensure all clients are notified
        const finalRoom = await getRoom(roomId);
        
        // Broadcast countdown_start - start_at will come from Postgres subscription
        // Clients will fetch full state from Postgres when they receive this
        broadcastToWebSocket(roomId, {
          type: 'countdown_start'
        });
        // Also broadcast state_update to trigger Postgres fetch
        broadcastToWebSocket(roomId, {
          type: 'state_update'
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

