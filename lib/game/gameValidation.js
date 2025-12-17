import { BOARD_SIZE, BOX_SIZE } from '../../src/js/system/constants.js';

/**
 * Game validation utilities
 */
export class GameValidation {
  /**
   * Validate placeNumber action
   */
  static validatePlaceNumber(state, row, col, value) {
    // Check bounds
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { valid: false, error: 'Invalid cell coordinates', errorCode: 'INVALID_MOVE' };
    }

    // Check value range
    if (value < 1 || value > 9) {
      return { valid: false, error: 'Invalid value (must be 1-9)', errorCode: 'INVALID_MOVE' };
    }

    // Check if cell is prefilled
    if (state.currentPuzzle[row][col] !== 0) {
      return { valid: false, error: 'Cannot place number in prefilled cell', errorCode: 'INVALID_MOVE' };
    }

    return { valid: true };
  }

  /**
   * Check if puzzle is complete
   */
  static isPuzzleComplete(board) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === 0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if board matches solution
   */
  static boardMatchesSolution(board, solution) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] !== solution[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if row is complete
   */
  static isRowComplete(board, row) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if column is complete
   */
  static isColumnComplete(board, col) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if box is complete
   */
  static isBoxComplete(board, row, col) {
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

    for (let i = boxRow; i < boxRow + BOX_SIZE; i++) {
      for (let j = boxCol; j < boxCol + BOX_SIZE; j++) {
        if (board[i][j] === 0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get box index
   */
  static getBoxIndex(row, col) {
    const boxRow = Math.floor(row / BOX_SIZE);
    const boxCol = Math.floor(col / BOX_SIZE);
    return boxRow * BOX_SIZE + boxCol;
  }
}


