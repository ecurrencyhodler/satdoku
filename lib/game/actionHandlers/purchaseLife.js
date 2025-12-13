import { storeGameState } from '../../redis/gameState.js';

/**
 * Handle purchaseLife action
 */
export async function handlePurchaseLife(sessionId, state, action, currentVersion) {
  // TODO: Verify payment session ID
  // For now, just add a life
  const updatedState = {
    ...state,
    lives: state.lives + 1,
    livesPurchased: (state.livesPurchased || 0) + 1
  };
  
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
