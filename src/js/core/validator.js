import { BOARD_SIZE, BOX_SIZE } from '../system/constants.js';

// Input validation for Sudoku
export class Validator {
    constructor(solution) {
        this.solution = solution;
        this.size = BOARD_SIZE;
        this.boxSize = BOX_SIZE;
    }

    // Check if a value is correct for a given position
    isValidMove(board, row, col, value) {
        if (value === 0) return true; // Empty cell is always valid
        
        // Check against solution
        if (this.solution[row][col] !== value) {
            return false;
        }
        
        // Also check Sudoku rules (no duplicates in row, col, box)
        return this.isValidPlacement(board, row, col, value);
    }

    // Check if a value can be placed according to Sudoku rules
    isValidPlacement(board, row, col, value) {
        // Check row
        for (let j = 0; j < this.size; j++) {
            if (j !== col && board[row][j] === value) {
                return false;
            }
        }
        
        // Check column
        for (let i = 0; i < this.size; i++) {
            if (i !== row && board[i][col] === value) {
                return false;
            }
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / this.boxSize) * this.boxSize;
        const boxCol = Math.floor(col / this.boxSize) * this.boxSize;
        
        for (let i = boxRow; i < boxRow + this.boxSize; i++) {
            for (let j = boxCol; j < boxCol + this.boxSize; j++) {
                if (i !== row && j !== col && board[i][j] === value) {
                    return false;
                }
            }
        }
        
        return true;
    }
}

