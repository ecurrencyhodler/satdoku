import { getRoom, updateRoomState, validateGameStarted } from '../../supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';

/**
 * Handle selectCell action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col
 * @returns {Promise<object>}
 */
export async function handleVersusSelectCell(roomId, sessionId, action) {
  const { row, col } = action;

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

  // Validate game has started
  const gameStarted = await validateGameStarted(room);
  if (!gameStarted.valid) {
    return {
      success: false,
      error: gameStarted.error,
      errorCode: gameStarted.errorCode
    };
  }

  // Update player's selected cell
  const updatedRoom = {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        ...player,
        selectedCell: { row, col }
      }
    }
  };

  // Save updated state (no version check needed for selection - it's not critical)
  const result = await updateRoomState(roomId, updatedRoom, null);

  if (!result.success) {
    return {
      success: false,
      error: 'Failed to save selection',
      errorCode: 'NETWORK_ERROR'
    };
  }

  // Broadcast cell selection (ephemeral UI data - doesn't need Postgres fetch)
  broadcastToWebSocket(roomId, {
    type: 'cell_selected',
    playerId,
    selectedCell: { row, col }
  }, playerId);

  return {
    success: true,
    state: updatedRoom,
    version: result.version
  };
}

