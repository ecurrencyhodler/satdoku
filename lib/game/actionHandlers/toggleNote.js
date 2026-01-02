import { storeGameState } from '../../redis/gameState.js';

/**
 * Handle toggleNote action - add/remove a number from notes array for a cell
 */
export async function handleToggleNote(sessionId, state, action, currentVersion) {
  const { row, col, value } = action;

  // Validate bounds
  if (row < 0 || row >= 9 || col < 0 || col >= 9) {
    return {
      success: false,
      error: 'Invalid cell coordinates',
      errorCode: 'INVALID_MOVE',
      version: currentVersion
    };
  }

  // Validate value range
  if (value < 1 || value > 9) {
    return {
      success: false,
      error: 'Invalid value (must be 1-9)',
      errorCode: 'INVALID_MOVE',
      version: currentVersion
    };
  }

  // Check if cell is prefilled - cannot add notes to prefilled cells
  if (state.currentPuzzle[row][col] !== 0) {
    return {
      success: false,
      error: 'Cannot add notes to prefilled cell',
      errorCode: 'INVALID_MOVE',
      version: currentVersion
    };
  }

  // Initialize notes if it doesn't exist (for backward compatibility)
  if (!state.notes) {
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }

  // Get current notes for this cell
  const currentNotes = state.notes[row][col] || [];

  // Toggle: if value is in notes, remove it; otherwise add it
  let updatedNotes;
  if (currentNotes.includes(value)) {
    updatedNotes = currentNotes.filter(n => n !== value);
  } else {
    updatedNotes = [...currentNotes, value].sort((a, b) => a - b);
  }

  // Create updated state with modified notes
  const updatedNotesArray = state.notes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? updatedNotes : c) : r
  );

  const updatedState = {
    ...state,
    notes: updatedNotesArray
  };

  // Save updated state
  const result = await storeGameState(sessionId, updatedState, currentVersion);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version || currentVersion
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR',
      version: currentVersion
    };
  }

  return {
    success: true,
    state: { ...updatedState, version: result.version },
    scoreDelta: { points: 0, events: [] },
    modals: { win: false, gameOver: false, purchaseLife: false },
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}









