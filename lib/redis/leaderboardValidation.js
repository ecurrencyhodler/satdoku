import { getGameState } from './gameState.js';
import { isPuzzleAlreadySubmitted } from './puzzleSubmissionTracking.js';

const BOARD_SIZE = 9;
const BOX_SIZE = 3;
const SCORE_VALUES = {
  correctCell: 1,
  completeRow: 5,
  completeColumn: 5,
  completeBox: 10
};

/**
 * Recalculate score from a completed board state
 * This replicates the scoring logic from ScoringEngine
 * @param {Array<Array<number>>} board - The completed board (9x9 array)
 * @returns {number} The calculated score
 */
function recalculateScore(board) {
  let score = 0;
  const completedRows = new Set();
  const completedColumns = new Set();
  const completedBoxes = new Set();

  // Process each cell
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Add point for each filled cell
      if (board[row][col] !== 0) {
        score += SCORE_VALUES.correctCell;

        // Check for row completion
        if (!completedRows.has(row)) {
          let rowComplete = true;
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[row][c] === 0) {
              rowComplete = false;
              break;
            }
          }
          if (rowComplete) {
            completedRows.add(row);
            score += SCORE_VALUES.completeRow;
          }
        }

        // Check for column completion
        if (!completedColumns.has(col)) {
          let colComplete = true;
          for (let r = 0; r < BOARD_SIZE; r++) {
            if (board[r][col] === 0) {
              colComplete = false;
              break;
            }
          }
          if (colComplete) {
            completedColumns.add(col);
            score += SCORE_VALUES.completeColumn;
          }
        }

        // Check for box completion
        const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        const boxIndex = Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE);

        if (!completedBoxes.has(boxIndex)) {
          let boxComplete = true;
          for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
            for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
              if (board[r][c] === 0) {
                boxComplete = false;
                break;
              }
            }
            if (!boxComplete) break;
          }
          if (boxComplete) {
            completedBoxes.add(boxIndex);
            score += SCORE_VALUES.completeBox;
          }
        }
      }
    }
  }

  return score;
}

/**
 * Check if board is complete (all 81 cells filled)
 * @param {Array<Array<number>>} board - The board to check
 * @returns {boolean}
 */
function isBoardComplete(board) {
  if (!board || !Array.isArray(board) || board.length !== BOARD_SIZE) {
    return false;
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!Array.isArray(board[row]) || board[row].length !== BOARD_SIZE) {
      return false;
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if board matches solution (all values are correct)
 * @param {Array<Array<number>>} board - The completed board
 * @param {Array<Array<number>>} solution - The solution to validate against
 * @returns {boolean}
 */
function boardMatchesSolution(board, solution) {
  if (!board || !solution) {
    return false;
  }

  if (board.length !== BOARD_SIZE || solution.length !== BOARD_SIZE) {
    return false;
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    if (board[row].length !== BOARD_SIZE || solution[row].length !== BOARD_SIZE) {
      return false;
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== solution[row][col]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Validate game state and score for leaderboard submission
 * @param {string} sessionId - The session ID
 * @param {number} submittedScore - The score being submitted
 * @returns {Promise<{valid: boolean, error?: string, recalculatedScore?: number}>}
 */
export async function validateLeaderboardSubmission(sessionId, submittedScore) {
  // 1. Get game state from Redis
  const gameState = await getGameState(sessionId);
  
  if (!gameState) {
    return {
      valid: false,
      error: 'Game state not found. Please complete a game before submitting to the leaderboard.'
    };
  }

  // 2. Validate required fields exist
  if (!gameState.currentBoard || !gameState.currentSolution) {
    return {
      valid: false,
      error: 'Invalid game state: missing board or solution data.'
    };
  }

  const board = gameState.currentBoard;
  const solution = gameState.currentSolution;

  // 3. Check if board is complete (all 81 cells filled)
  if (!isBoardComplete(board)) {
    return {
      valid: false,
      error: 'Game is not complete. All cells must be filled before submitting to the leaderboard.'
    };
  }

  // 4. Check if board matches solution (all values are correct)
  if (!boardMatchesSolution(board, solution)) {
    return {
      valid: false,
      error: 'Board contains incorrect values. All cells must be correct before submitting to the leaderboard.'
    };
  }

  // 5. Recalculate score from board state
  const recalculatedScore = recalculateScore(board);

  // 6. Verify submitted score matches recalculated score
  if (submittedScore !== recalculatedScore) {
    return {
      valid: false,
      error: `Score mismatch. Expected ${recalculatedScore} but received ${submittedScore}.`,
      recalculatedScore
    };
  }

  // 7. Check if this puzzle has already been submitted
  const alreadySubmitted = await isPuzzleAlreadySubmitted(sessionId, solution);
  if (alreadySubmitted) {
    return {
      valid: false,
      error: 'This puzzle has already been submitted to the leaderboard.'
    };
  }

  // All validations passed
  return {
    valid: true,
    recalculatedScore
  };
}

