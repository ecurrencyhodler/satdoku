/**
 * Utility functions for transforming server game state to client format
 */

/**
 * Validates and normalizes a board array to ensure it's a proper 2D array
 * @param {Array} board - The board array to validate
 * @returns {Array} Validated 2D array
 * @throws {Error} If board structure is invalid
 */
export function validateBoard(board) {
  if (!board || !Array.isArray(board)) {
    throw new Error('Invalid board structure: board must be an array');
  }

  // Ensure board is a proper 2D array (not sparse)
  return board.map((row) => {
    if (!Array.isArray(row)) {
      return Array(9).fill(0); // Return empty row as fallback
    }
    return row;
  });
}

/**
 * Transforms server game state to client format
 * @param {Object} serverState - Server state object with currentBoard, currentPuzzle, etc.
 * @returns {Object} Client state object with board, puzzle, etc.
 */
export function transformServerStateToClient(serverState) {
  if (!serverState) {
    throw new Error('Server state is required');
  }

  // Validate board structure
  if (!serverState.currentBoard || !Array.isArray(serverState.currentBoard)) {
    throw new Error('Invalid board structure received from server');
  }

  // Ensure board is a proper 2D array (not sparse)
  const validatedBoard = validateBoard(serverState.currentBoard);

  // Initialize notes if it doesn't exist (for backward compatibility)
  let notes = serverState.notes;
  if (!notes || !Array.isArray(notes)) {
    notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  }

  // Transform server state to client format
  return {
    board: validatedBoard,
    puzzle: serverState.currentPuzzle,
    solution: serverState.currentSolution,
    difficulty: serverState.difficulty,
    mistakes: serverState.mistakes,
    gameInProgress: serverState.gameInProgress,
    score: serverState.score,
    moves: serverState.moves,
    lives: serverState.lives,
    livesPurchased: serverState.livesPurchased || 0,
    completedRows: serverState.completedRows || [],
    completedColumns: serverState.completedColumns || [],
    completedBoxes: serverState.completedBoxes || [],
    version: serverState.version,
    notes: notes
  };
}








