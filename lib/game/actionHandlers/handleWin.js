import { getGameState, storeGameState } from '../../redis/gameState.js';
import { saveCompletion } from '../../redis/completions.js';
import { checkScoreQualifies } from '../../redis/leaderboard.js';
import { GameValidation } from '../gameValidation.js';

/**
 * Handle win condition
 */
export async function handleWin(sessionId, state, currentVersion, scoreDelta) {
  // Validate board is complete and correct
  if (!GameValidation.isPuzzleComplete(state.currentBoard) ||
      !GameValidation.boardMatchesSolution(state.currentBoard, state.currentSolution)) {
    // Should not happen, but handle gracefully
    return {
      success: false,
      error: 'Board validation failed',
      errorCode: 'NETWORK_ERROR',
      version: currentVersion
    };
  }

  // Calculate duration
  const gameStartTime = new Date(state.gameStartTime || new Date().toISOString());
  const completedAt = new Date();
  const duration = Math.floor((completedAt - gameStartTime) / 1000);

  // Check if score qualifies for leaderboard
  const qualifies = await checkScoreQualifies(state.score);

  // Generate completion ID
  const completionId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  // Create completion record
  const completion = {
    completionId,
    sessionId,
    score: state.score,
    difficulty: state.difficulty,
    mistakes: state.mistakes,
    moves: state.moves,
    duration,
    completedAt: completedAt.toISOString(),
    eligibleForLeaderboard: qualifies,
    submittedToLeaderboard: false
  };

  // Save completion first (this is critical data that must be preserved)
  const completionSaved = await saveCompletion(completion);

  if (!completionSaved) {
    // If completion save fails, this is critical - return error
    console.error('[handleWin] Failed to save completion record');
    return {
      success: false,
      error: 'Failed to save completion record',
      errorCode: 'NETWORK_ERROR',
      version: currentVersion
    };
  }

  // Update state to mark game as complete
  const updatedState = {
    ...state,
    gameInProgress: false
  };

  // Retry state save up to 3 times on version conflict
  let result = await storeGameState(sessionId, updatedState, currentVersion);
  let retryCount = 0;
  const maxRetries = 3;

  while (!result.success && result.conflict && retryCount < maxRetries) {
    retryCount++;
    console.log(`[handleWin] Retrying state save after win (attempt ${retryCount}/${maxRetries})`);

    // Reload state to get current version
    const currentState = await getGameState(sessionId);
    if (!currentState) {
      console.error('[handleWin] Failed to reload state for retry');
      break;
    }

    // Update with current state but keep gameInProgress false
    const retryState = {
      ...currentState,
      gameInProgress: false
    };

    result = await storeGameState(sessionId, retryState, currentState.version);
  }

  if (!result.success) {
    // State save failed after retries, but completion is saved
    // Log error but return success since completion is the critical data
    // Client can reload state to see the completion
    console.error('[handleWin] Failed to save state after win after retries, but completion saved. State may be inconsistent.');

    // Return success but indicate state save failed
    return {
      success: true,
      state: { ...updatedState, version: currentVersion },
      scoreDelta,
      modals: { win: true, gameOver: false, purchaseLife: false },
      completed: true,
      completionId,
      qualifiedForLeaderboard: qualifies,
      version: currentVersion,
      warning: 'State save failed but completion was saved. Please reload to see updated state.'
    };
  }

  return {
    success: true,
    state: { ...updatedState, version: result.version },
    scoreDelta,
    modals: { win: true, gameOver: false, purchaseLife: false },
    completed: true,
    completionId,
    qualifiedForLeaderboard: qualifies,
    version: result.version
  };
}



