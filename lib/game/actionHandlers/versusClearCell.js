import { getRoom, updateRoomState, validateGameStarted } from '../../supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';

/**
 * Handle clearCell action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col
 * @returns {Promise<object>}
 */
export async function handleVersusClearCell(roomId, sessionId, action) {
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

  // Check if game is in progress
  if (room.status !== 'active') {
    return {
      success: false,
      error: 'Game is not in progress',
      errorCode: 'GAME_NOT_STARTED'
    };
  }

  // Validate cell coordinates
  if (row < 0 || row >= 9 || col < 0 || col >= 9) {
    return {
      success: false,
      error: 'Invalid cell coordinates',
      errorCode: 'INVALID_MOVE'
    };
  }

  // Check if cell is prefilled - cannot clear prefilled cells
  if (room.currentPuzzle[row][col] !== 0) {
    return {
      success: false,
      error: 'Cannot clear prefilled cell',
      errorCode: 'INVALID_MOVE'
    };
  }

  const currentValue = room.currentBoard[row][col];
  const puzzleValue = room.currentPuzzle[row][col];
  const solutionValue = room.currentSolution[row][col];
  
  // Check if this is a mistake (incorrect value on shared board)
  const isMistake = currentValue !== 0 && 
                     puzzleValue === 0 && 
                     currentValue !== solutionValue;

  // If it's a mistake, track it as cleared for this player instead of removing from board
  // This way the mistake persists for the other player
  let clearedMistakes = player.clearedMistakes || [];
  let updatedBoard = room.currentBoard;
  
  if (isMistake) {
    // Track as cleared mistake for this player
    const cellKey = `${row},${col}`;
    if (!clearedMistakes.includes(cellKey)) {
      clearedMistakes = [...clearedMistakes, cellKey];
    }
    // Don't remove from board - keep it for the other player
  } else if (currentValue !== 0) {
    // If it's not a mistake (correct value), actually clear it from the board
    // This handles clearing correct values
    updatedBoard = room.currentBoard.map((r, i) =>
      i === row ? r.map((c, j) => j === col ? 0 : c) : r
    );
  }
  // If currentValue === 0, cell is already empty, just clear notes

  // Clear notes for this cell
  const updatedPlayerNotes = player.notes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? [] : c) : r
  );

  const updatedRoom = {
    ...room,
    currentBoard: updatedBoard,
    players: {
      ...room.players,
      [playerId]: {
        ...player,
        notes: updatedPlayerNotes,
        clearedMistakes: clearedMistakes
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
    state: {
      ...updatedRoom,
      version: result.version
    },
    version: result.version
  };
}
