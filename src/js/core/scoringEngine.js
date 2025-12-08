import { BOARD_SIZE, BOX_SIZE, SCORE_VALUES } from '../system/constants.js';

// Scoring system for the game
export class ScoringEngine {
    constructor() {
        this.score = 0;
        this.moves = 0;
        this.completedRows = new Set();
        this.completedColumns = new Set();
        this.completedBoxes = new Set();
    }

    reset() {
        this.score = 0;
        this.moves = 0;
        this.completedRows.clear();
        this.completedColumns.clear();
        this.completedBoxes.clear();
    }

    // Process a correct move and return score events
    processMove(board, row, col) {
        this.moves++;
        const events = [];
        
        // Check for row completion
        if (!this.completedRows.has(row) && this.isRowComplete(board, row)) {
            this.completedRows.add(row);
            this.score += SCORE_VALUES.completeRow;
            events.push({
                type: 'row',
                row,
                score: SCORE_VALUES.completeRow
            });
        }
        
        // Check for column completion
        if (!this.completedColumns.has(col) && this.isColumnComplete(board, col)) {
            this.completedColumns.add(col);
            this.score += SCORE_VALUES.completeColumn;
            events.push({
                type: 'column',
                column: col,
                score: SCORE_VALUES.completeColumn
            });
        }
        
        // Check for box completion
        const boxIndex = this.getBoxIndex(row, col);
        if (!this.completedBoxes.has(boxIndex) && this.isBoxComplete(board, row, col)) {
            this.completedBoxes.add(boxIndex);
            this.score += SCORE_VALUES.completeBox;
            events.push({
                type: 'box',
                boxIndex,
                score: SCORE_VALUES.completeBox
            });
        }
        
        // Always add point for correct cell
        this.score += SCORE_VALUES.correctCell;
        events.push({
            type: 'cell',
            row,
            col,
            score: SCORE_VALUES.correctCell
        });
        
        return events;
    }

    // Check if a row is complete
    isRowComplete(board, row) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === 0) {
                return false;
            }
        }
        return true;
    }

    // Check if a column is complete
    isColumnComplete(board, col) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            if (board[row][col] === 0) {
                return false;
            }
        }
        return true;
    }

    // Check if a 3x3 box is complete
    isBoxComplete(board, row, col) {
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

    // Get box index (0-8) for a given position
    getBoxIndex(row, col) {
        const boxRow = Math.floor(row / BOX_SIZE);
        const boxCol = Math.floor(col / BOX_SIZE);
        return boxRow * BOX_SIZE + boxCol;
    }

    // Get cells in a box
    getBoxCells(boxIndex) {
        const boxRow = Math.floor(boxIndex / BOX_SIZE) * BOX_SIZE;
        const boxCol = (boxIndex % BOX_SIZE) * BOX_SIZE;
        const cells = [];
        
        for (let i = boxRow; i < boxRow + BOX_SIZE; i++) {
            for (let j = boxCol; j < boxCol + BOX_SIZE; j++) {
                cells.push({ row: i, col: j });
            }
        }
        
        return cells;
    }

    getScore() {
        return this.score;
    }

    getMoves() {
        return this.moves;
    }

    getCompletedRows() {
        return Array.from(this.completedRows);
    }

    getCompletedColumns() {
        return Array.from(this.completedColumns);
    }

    getCompletedBoxes() {
        return Array.from(this.completedBoxes);
    }
}

