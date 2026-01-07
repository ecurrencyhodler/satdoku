import { NextResponse } from 'next/server';
import { getSessionId, getSessionIdIfExists } from '../../../../lib/session/cookieSession.js';
import { createRoom, joinRoom, getRoom } from '../../../../lib/redis/versusRooms.js';
import { createVersusGameState } from '../../../../lib/game/versusGameState.js';
import { updateRoomState } from '../../../../lib/redis/versusRooms.js';

/**
 * POST /api/versus/init - Create a new room
 * Body: { difficulty: string, playerName: string }
 */
export async function POST(request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();
    const { difficulty, playerName } = body;

    if (!difficulty || !['beginner', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json(
        { success: false, error: 'Invalid difficulty' },
        { status: 400 }
      );
    }

    // Create room
    const result = await createRoom(sessionId, difficulty, playerName || 'Player 1');
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Generate puzzle for the room
    const gameState = await createVersusGameState(difficulty);
    
    // Update room with puzzle data
    const room = await getRoom(result.roomId);
    if (room) {
      const updatedRoom = {
        ...room,
        currentBoard: gameState.currentBoard,
        currentPuzzle: gameState.currentPuzzle,
        currentSolution: gameState.currentSolution,
        board: gameState.currentBoard, // Alias for compatibility
        puzzle: gameState.currentPuzzle, // Alias for compatibility
        solution: gameState.currentSolution // Alias for compatibility
      };
      await updateRoomState(result.roomId, updatedRoom, room.version);
      
      // Small delay to ensure Redis write is fully propagated
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      roomId: result.roomId,
      roomUrl: `/versus?room=${result.roomId}`,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('[versus/init] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/versus/init?room=abc123 - Join a room
 * GET /api/versus/init (no room) - Get sessionId for creating a room
 */
export async function GET(request) {
  try {
    const sessionId = await getSessionId();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room');

    // If no roomId, just return sessionId for creating a room
    if (!roomId) {
      return NextResponse.json({
        success: true,
        sessionId: sessionId
      });
    }

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Get room to check if it exists
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check if user is player 1
    if (room.players.player1?.sessionId === sessionId) {
      return NextResponse.json({
        success: true,
        roomId,
        playerId: 'player1',
        isSpectator: false,
        room,
        sessionId: sessionId
      });
    }

    // Check if user is player 2
    if (room.players.player2?.sessionId === sessionId) {
      return NextResponse.json({
        success: true,
        roomId,
        playerId: 'player2',
        isSpectator: false,
        room,
        sessionId: sessionId
      });
    }

    // Try to join as player 2
    const joinResult = await joinRoom(roomId, sessionId, 'Player 2');
    
    if (!joinResult.success) {
      if (joinResult.isSpectator) {
        // Room is full, allow as spectator
        return NextResponse.json({
          success: true,
          roomId,
          playerId: null,
          isSpectator: true,
          room,
          sessionId: sessionId
        });
      }
      return NextResponse.json(
        { success: false, error: joinResult.error },
        { status: 400 }
      );
    }

    // Get updated room
    const updatedRoom = await getRoom(roomId);
    
    return NextResponse.json({
      success: true,
      roomId,
      playerId: 'player2',
      isSpectator: false,
      room: updatedRoom,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('[versus/init] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

