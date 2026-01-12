import { updateRoomState } from '../../supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';
import {
  validateVersusAction,
  validateCellCoordinates,
  isCellPrefilled,
  initializeNotes,
  clearCellNotes,
  createVersionConflictResponse,
  createNetworkErrorResponse
} from '../versusHandlerUtils.js';

/**
 * Handle clearCell action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col
 * @returns {Promise<object>}
 */
export async function handleVersusClearCell(roomId, sessionId, action) {
  const { row, col } = action;

  // Validate cell coordinates
  const coordValidation = validateCellCoordinates(row, col);
  if (!coordValidation.valid) {
    return coordValidation;
  }

  // Validate room and player
  const validation = await validateVersusAction(roomId, sessionId);
  if (!validation.success) {
    return validation;
  }

  const { room, playerId, player } = validation;

  // Check if cell is prefilled - cannot clear prefilled cells
  if (isCellPrefilled(room.currentPuzzle, row, col)) {
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
  const initializedNotes = initializeNotes(player.notes);
  const updatedPlayerNotes = clearCellNotes(initializedNotes, row, col);

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
      return createVersionConflictResponse(result.version);
    }
    return createNetworkErrorResponse();
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
