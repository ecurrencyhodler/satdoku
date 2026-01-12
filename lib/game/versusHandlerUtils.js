import { getRoom, validateGameStarted } from '../supabase/versusRooms.js';
import { BOARD_SIZE } from '../../src/js/system/constants.js';

/**
 * Shared utilities for versus game action handlers
 */

/**
 * Get player information from room by sessionId
 * @param {object} room - Room state
 * @param {string} sessionId - Player's session ID
 * @returns {{playerId: string, player: object}|null}
 */
export function getPlayerFromRoom(room, sessionId) {
  if (room.players.player1?.sessionId === sessionId) {
    return {
      playerId: 'player1',
      player: room.players.player1
    };
  } else if (room.players.player2?.sessionId === sessionId) {
    return {
      playerId: 'player2',
      player: room.players.player2
    };
  }
  return null;
}

/**
 * Validate room and player for versus action
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @returns {Promise<{success: boolean, room?: object, playerId?: string, player?: object, error?: string, errorCode?: string}>}
 */
export async function validateVersusAction(roomId, sessionId) {
  const room = await getRoom(roomId);
  if (!room) {
    return {
      success: false,
      error: 'Room not found',
      errorCode: 'ROOM_NOT_FOUND'
    };
  }

  const playerInfo = getPlayerFromRoom(room, sessionId);
  if (!playerInfo) {
    return {
      success: false,
      error: 'Player not found in room',
      errorCode: 'PLAYER_NOT_FOUND'
    };
  }

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

  return {
    success: true,
    room,
    playerId: playerInfo.playerId,
    player: playerInfo.player
  };
}

/**
 * Validate cell coordinates
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {{valid: boolean, error?: string, errorCode?: string}}
 */
export function validateCellCoordinates(row, col) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return {
      valid: false,
      error: 'Invalid cell coordinates',
      errorCode: 'INVALID_MOVE'
    };
  }
  return { valid: true };
}

/**
 * Validate value range (1-9)
 * @param {number} value - Value to validate
 * @returns {{valid: boolean, error?: string, errorCode?: string}}
 */
export function validateValueRange(value) {
  if (value < 1 || value > 9) {
    return {
      valid: false,
      error: 'Invalid value (must be 1-9)',
      errorCode: 'INVALID_MOVE'
    };
  }
  return { valid: true };
}

/**
 * Check if cell is prefilled
 * @param {number[][]} puzzle - Puzzle array
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {boolean}
 */
export function isCellPrefilled(puzzle, row, col) {
  return puzzle[row]?.[col] !== 0;
}

/**
 * Initialize notes array if needed
 * @param {Array} notes - Existing notes array (may be undefined)
 * @returns {Array} Initialized 9x9 array of empty arrays
 */
export function initializeNotes(notes) {
  if (!notes || !Array.isArray(notes)) {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }
  return notes;
}

/**
 * Toggle a note value in a cell's notes array
 * @param {Array} cellNotes - Current notes for the cell
 * @param {number} value - Value to toggle
 * @returns {Array} Updated notes array (sorted)
 */
export function toggleNoteValue(cellNotes, value) {
  const notes = [...(cellNotes || [])];
  const noteIndex = notes.indexOf(value);
  
  if (noteIndex >= 0) {
    // Remove note
    notes.splice(noteIndex, 1);
  } else {
    // Add note
    notes.push(value);
    notes.sort((a, b) => a - b);
  }
  
  return notes;
}

/**
 * Clear notes for a specific cell
 * @param {Array} notes - Full notes array (9x9)
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {Array} Updated notes array
 */
export function clearCellNotes(notes, row, col) {
  return notes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? [] : c) : r
  );
}

/**
 * Create standard error response
 * @param {string} error - Error message
 * @param {string} errorCode - Error code
 * @param {number|null} version - Optional version number
 * @returns {object}
 */
export function createErrorResponse(error, errorCode, version = null) {
  const response = {
    success: false,
    error,
    errorCode
  };
  if (version !== null) {
    response.version = version;
  }
  return response;
}

/**
 * Create version conflict error response
 * @param {number} version - Current version
 * @returns {object}
 */
export function createVersionConflictResponse(version) {
  return {
    success: false,
    error: 'Version conflict - state was modified by another operation',
    errorCode: 'VERSION_CONFLICT',
    version
  };
}

/**
 * Create network error response
 * @param {number|null} version - Optional version number
 * @returns {object}
 */
export function createNetworkErrorResponse(version = null) {
  return createErrorResponse('Failed to save game state', 'NETWORK_ERROR', version);
}
