import { BOARD_SIZE, BOX_SIZE } from '../system/constants.js';

// Sudoku board generator
export class BoardGenerator {
    constructor() {
        this.size = BOARD_SIZE;
        this.boxSize = BOX_SIZE;
    }

    // Generate a complete valid Sudoku solution
    generateSolution() {
        const board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
        
        // Fill diagonal boxes first (they are independent)
        for (let box = 0; box < this.size; box += this.boxSize) {
            this.fillBox(board, box, box);
        }
        
        // Solve the rest
        this.solveSudoku(board);
        
        return board;
    }

    // Fill a 3x3 box with random valid numbers
    fillBox(board, row, col) {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.shuffle(numbers);
        
        let index = 0;
        for (let i = 0; i < this.boxSize; i++) {
            for (let j = 0; j < this.boxSize; j++) {
                board[row + i][col + j] = numbers[index++];
            }
        }
    }

    // Solve Sudoku using backtracking
    solveSudoku(board) {
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (board[row][col] === 0) {
                    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    this.shuffle(numbers);
                    
                    for (const num of numbers) {
                        if (this.isValid(board, row, col, num)) {
                            board[row][col] = num;
                            
                            if (this.solveSudoku(board)) {
                                return true;
                            }
                            
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // Check if a number can be placed at a position
    isValid(board, row, col, num) {
        // Check row
        for (let j = 0; j < this.size; j++) {
            if (board[row][j] === num) return false;
        }
        
        // Check column
        for (let i = 0; i < this.size; i++) {
            if (board[i][col] === num) return false;
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / this.boxSize) * this.boxSize;
        const boxCol = Math.floor(col / this.boxSize) * this.boxSize;
        
        for (let i = boxRow; i < boxRow + this.boxSize; i++) {
            for (let j = boxCol; j < boxCol + this.boxSize; j++) {
                if (board[i][j] === num) return false;
            }
        }
        
        return true;
    }

    // Shuffle array using Fisher-Yates algorithm
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Remove cells based on difficulty
    // Simplified version: removes cells randomly without checking for unique solution
    // This is faster and acceptable for MVP
    removeCells(board, cellsToRemove) {
        const positions = [];
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                positions.push([i, j]);
            }
        }
        
        this.shuffle(positions);
        
        const puzzle = board.map(row => [...row]);
        
        // Remove cells randomly up to the target count
        for (let i = 0; i < Math.min(cellsToRemove, positions.length); i++) {
            const [row, col] = positions[i];
            puzzle[row][col] = 0;
        }
        
        return puzzle;
    }

    // Generate puzzle with given difficulty
    generatePuzzle(difficulty) {
        const solution = this.generateSolution();
        const cellsToRemove = difficulty.cellsToRemove;
        const puzzle = this.removeCells(solution, cellsToRemove);
        
        return {
            puzzle,
            solution
        };
    }
}

