import { getRoom, updateRoomState, validateGameStarted } from '../../supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';

/**
 * Handle toggleNote action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col, value
 * @returns {Promise<object>}
 */
export async function handleVersusToggleNote(roomId, sessionId, action) {
  const { row, col, value } = action;

  // Get current room state
  const room = await getRoom(roomId);
  if (!room) {
    return {
      success: false,
      error: 'Room not found',
      errorCode: 'ROOM_NOT_FOUND'
    };
  }

  // Determine which player this is
  let playerId = null;
  let player = null;
  if (room.players.player1?.sessionId === sessionId) {
    playerId = 'player1';
    player = room.players.player1;
  } else if (room.players.player2?.sessionId === sessionId) {
    playerId = 'player2';
    player = room.players.player2;
  } else {
    return {
      success: false,
      error: 'Player not found in room',
      errorCode: 'PLAYER_NOT_FOUND'
    };
  }

  // Check if game is in progress
  // Validate game has started
  const gameStarted = await validateGameStarted(room);
  if (!gameStarted.valid) {
    return {
      success: false,
      error: gameStarted.error,
      errorCode: gameStarted.errorCode
    };
  }

  if (room.status !== 'active') {
    return {
      success: false,
      error: 'Game is not in progress',
      errorCode: 'GAME_NOT_STARTED'
    };
  }

  // Initialize notes if needed
  if (!player.notes || !Array.isArray(player.notes)) {
    player.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }

  // Toggle note
  const cellNotes = player.notes[row]?.[col] || [];
  const noteIndex = cellNotes.indexOf(value);
  
  let updatedNotes = [...cellNotes];
  if (noteIndex >= 0) {
    // Remove note
    updatedNotes.splice(noteIndex, 1);
  } else {
    // Add note
    updatedNotes.push(value);
    updatedNotes.sort((a, b) => a - b);
  }

  // Update player's notes
  const updatedPlayerNotes = player.notes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? updatedNotes : c) : r
  );

  const updatedRoom = {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        ...player,
        notes: updatedPlayerNotes
      }
    }
  };

  // Save updated state
  const result = await updateRoomState(roomId, updatedRoom, room.version);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR'
    };
  }

  // Broadcast minimal notification - clients will fetch full state from Postgres
  broadcastToWebSocket(roomId, {
    type: 'state_update'
  });

  return {
    success: true,
    state: updatedRoomWithVersion,
    version: result.version
  };
}

