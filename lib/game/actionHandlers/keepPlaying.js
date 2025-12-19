import { storeGameState } from '../../redis/gameState.js';
import { BoardGenerator } from '../../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS } from '../../../src/js/system/constants.js';

/**
 * Handle keepPlaying action
 */
export async function handleKeepPlaying(sessionId, state, currentVersion) {
  // Generate new puzzle while preserving stats
  const difficultyConfig = DIFFICULTY_LEVELS[state.difficulty] || DIFFICULTY_LEVELS.beginner;
  const boardGenerator = new BoardGenerator();
  const { puzzle, solution } = boardGenerator.generatePuzzle(difficultyConfig);

  const updatedState = {
    ...state,
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]),
    completedRows: [],
    completedColumns: [],
    completedBoxes: []
    // Preserve: score, moves, mistakes, lives, livesPurchased, difficulty, gameStartTime
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






