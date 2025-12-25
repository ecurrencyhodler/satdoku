import { storeGameState } from '../../redis/gameState.js';

/**
 * Handle clearCell action
 */
export async function handleClearCell(sessionId, state, action, currentVersion) {
  const { row, col } = action;

  // Validate action
  if (state.currentPuzzle[row][col] !== 0) {
    return {
      success: false,
      error: 'Cannot clear prefilled cell',
      errorCode: 'INVALID_MOVE',
      version: currentVersion
    };
  }

  // Create updated state
  const updatedState = {
    ...state,
    currentBoard: state.currentBoard.map((r, i) =>
      i === row ? r.map((c, j) => j === col ? 0 : c) : r
    )
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


















