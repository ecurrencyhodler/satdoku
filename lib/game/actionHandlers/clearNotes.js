import { storeGameState } from '../../redis/gameState.js';

/**
 * Handle clearNotes action - clear all notes and incorrect guesses
 * Preserves prefilled cells and correctly guessed cells
 */
export async function handleClearNotes(sessionId, state, action, currentVersion) {
  // Initialize notes if it doesn't exist
  if (!state.notes) {
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }

  // Clear all notes
  const clearedNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  // Clear incorrect guesses from board (but preserve prefilled and correct cells)
  const updatedBoard = state.currentBoard.map((row, i) =>
    row.map((cellValue, j) => {
      const isPrefilled = state.currentPuzzle[i][j] !== 0;
      const correctValue = state.currentSolution[i][j];
      const isCorrect = cellValue === correctValue;

      // Keep prefilled cells and correct guesses, clear everything else
      if (isPrefilled || isCorrect) {
        return cellValue;
      } else {
        return 0;
      }
    })
  );

  const updatedState = {
    ...state,
    notes: clearedNotes,
    currentBoard: updatedBoard
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

