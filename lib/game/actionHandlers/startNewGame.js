import { storeGameState } from '../../redis/gameState.js';
import { BoardGenerator } from '../../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS, INITIAL_LIVES } from '../../../src/js/system/constants.js';

/**
 * Handle startNewGame action
 */
export async function handleStartNewGame(sessionId, difficulty, expectedVersion) {
  const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
  const boardGenerator = new BoardGenerator();
  const { puzzle, solution } = boardGenerator.generatePuzzle(difficultyConfig);

  // Initialize notes as 9x9 array of empty arrays
  const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  const newState = {
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]),
    difficulty: difficulty,
    mistakes: 0,
    score: 0,
    moves: 0,
    lives: INITIAL_LIVES,
    livesPurchased: 0,
    completedRows: [],
    completedColumns: [],
    completedBoxes: [],
    gameInProgress: true,
    gameStartTime: new Date().toISOString(),
    notes: notes
  };

  const result = await storeGameState(sessionId, newState, expectedVersion);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version || 0
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR'
    };
  }

  return {
    success: true,
    state: { ...newState, version: result.version },
    scoreDelta: { points: 0, events: [] },
    modals: { win: false, gameOver: false, purchaseLife: false },
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}










