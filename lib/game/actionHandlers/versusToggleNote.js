import { updateRoomState } from '../../supabase/versusRooms.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';
import {
  validateVersusAction,
  validateCellCoordinates,
  validateValueRange,
  isCellPrefilled,
  initializeNotes,
  toggleNoteValue,
  createVersionConflictResponse,
  createNetworkErrorResponse
} from '../versusHandlerUtils.js';

/**
 * Handle toggleNote action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col, value
 * @returns {Promise<object>}
 */
export async function handleVersusToggleNote(roomId, sessionId, action) {
  const { row, col, value } = action;

  // Validate cell coordinates
  const coordValidation = validateCellCoordinates(row, col);
  if (!coordValidation.valid) {
    return coordValidation;
  }

  // Validate value range
  const valueValidation = validateValueRange(value);
  if (!valueValidation.valid) {
    return valueValidation;
  }

  // Validate room and player
  const validation = await validateVersusAction(roomId, sessionId);
  if (!validation.success) {
    return validation;
  }

  const { room, playerId, player } = validation;

  // Check if cell is prefilled - cannot add notes to prefilled cells
  if (isCellPrefilled(room.currentPuzzle, row, col)) {
    return {
      success: false,
      error: 'Cannot add notes to prefilled cell',
      errorCode: 'INVALID_MOVE'
    };
  }

  // Initialize notes if needed
  const initializedNotes = initializeNotes(player.notes);
  
  // Toggle note
  const cellNotes = initializedNotes[row]?.[col] || [];
  const updatedCellNotes = toggleNoteValue(cellNotes, value);

  // Update player's notes
  const updatedPlayerNotes = initializedNotes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? updatedCellNotes : c) : r
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

