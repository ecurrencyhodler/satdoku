import { getGameState, storeGameState } from '../../redis/gameState.js';
import { saveCompletion } from '../../supabase/completions.js';
import { checkScoreQualifies } from '../../supabase/leaderboard.js';
import { trackPuzzleCompletion } from '../../supabase/puzzleSessions.js';
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
    startedAt: gameStartTime.toISOString(),
    completedAt: completedAt.toISOString(),
    eligibleForLeaderboard: qualifies,
    submittedToLeaderboard: false
  };

  // Track puzzle completion in Supabase (fire and forget)
  trackPuzzleCompletion(sessionId, state.difficulty).catch(err => {
    console.error('[handleWin] Failed to track puzzle completion:', err);
  });

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

    // Validate that game is still in progress (another action might have completed it)
    // If game is already complete, we don't need to update it
    if (!currentState.gameInProgress) {
      console.log('[handleWin] Game already marked as complete by another action, skipping state update');
      // Return success with current state
      return {
        success: true,
        state: { ...currentState, version: currentState.version },
        scoreDelta,
        modals: { win: true, gameOver: false, purchaseLife: false },
        completed: true,
        completionId,
        qualifiedForLeaderboard: qualifies,
        version: currentState.version
      };
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
    // Completion is the critical data, so we return success
    // However, we log this as an error for monitoring
    console.error('[handleWin] Failed to save state after win after retries, but completion saved. State may be inconsistent.');

    // Return success since completion is saved (critical data)
    // Client can reload state to see the completion
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













