import { storeGameState } from '../../redis/gameState.js';
import { GameValidation } from '../gameValidation.js';
import { GameScoring } from '../gameScoring.js';
import { handleWin } from './handleWin.js';

/**
 * Handle placeNumber action
 */
export async function handlePlaceNumber(sessionId, state, action, currentVersion) {
  const { row, col, value } = action;

  // Validate action
  const validation = GameValidation.validatePlaceNumber(state, row, col, value);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      errorCode: validation.errorCode || 'INVALID_MOVE',
      version: currentVersion
    };
  }

  // Check if player has lives
  if (state.lives <= 0) {
    return {
      success: false,
      error: 'No lives remaining. Please purchase a life to continue.',
      errorCode: 'NO_LIVES',
      version: currentVersion
    };
  }

  // Check if move is correct
  const isCorrect = state.currentSolution[row][col] === value;

  let updatedState;
  let scoreDelta = { points: 0, events: [] };
  let modals = { win: false, gameOver: false, purchaseLife: false };

  if (isCorrect) {
    // Process correct move - update board with correct value
    updatedState = {
      ...state,
      currentBoard: state.currentBoard.map((r, i) =>
        i === row ? r.map((c, j) => j === col ? value : c) : r
      )
    };

    const scoringResult = GameScoring.processCorrectMove(updatedState, row, col);
    updatedState.score = state.score + scoringResult.points;
    updatedState.moves = state.moves + 1;
    updatedState.completedRows = scoringResult.completedRows;
    updatedState.completedColumns = scoringResult.completedColumns;
    updatedState.completedBoxes = scoringResult.completedBoxes;
    scoreDelta = scoringResult.scoreDelta;

    // Check for win
    const isWin = GameValidation.isPuzzleComplete(updatedState.currentBoard);
    if (isWin) {
      return await handleWin(sessionId, updatedState, currentVersion, scoreDelta);
    }
  } else {
    // Process incorrect move - update board with incorrect value so it can be displayed in red
    updatedState = {
      ...state,
      currentBoard: state.currentBoard.map((r, i) =>
        i === row ? r.map((c, j) => j === col ? value : c) : r
      ),
      mistakes: state.mistakes + 1,
      lives: Math.max(0, state.lives - 1)
    };

    // Add error event to scoreDelta so client can show error animation
    scoreDelta = {
      points: 0,
      events: [{ type: 'error', row, col }]
    };

    // Check if lives reached 0
    if (updatedState.lives === 0) {
      modals.purchaseLife = true;
      // If no lives and can't purchase, show game over
      // (For now, we'll let the client handle this based on purchaseLife modal)
    }
  }

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
    scoreDelta,
    modals,
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}

