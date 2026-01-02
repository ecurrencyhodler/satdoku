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

    // Count the number of solutions for a puzzle
    // Returns as soon as it finds more than 1 solution for efficiency
    countSolutions(board, maxSolutions = 2) {
        let count = 0;
        
        const countHelper = (grid) => {
            // If we've already found enough solutions, stop searching
            if (count >= maxSolutions) return;
            
            // Find next empty cell
            for (let row = 0; row < this.size; row++) {
                for (let col = 0; col < this.size; col++) {
                    if (grid[row][col] === 0) {
                        // Try each number 1-9
                        for (let num = 1; num <= 9; num++) {
                            if (this.isValid(grid, row, col, num)) {
                                grid[row][col] = num;
                                countHelper(grid);
                                grid[row][col] = 0;
                            }
                        }
                        return; // Backtrack
                    }
                }
            }
            // Found a complete solution
            count++;
        };
        
        const gridCopy = board.map(row => [...row]);
        countHelper(gridCopy);
        return count;
    }

    // Check if puzzle has a unique solution
    hasUniqueSolution(board) {
        return this.countSolutions(board, 2) === 1;
    }

    // Remove cells based on difficulty while ensuring unique solution
    removeCells(board, cellsToRemove) {
        const puzzle = board.map(row => [...row]);
        
        // Create list of all positions
        const positions = [];
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                positions.push([i, j]);
            }
        }
        
        this.shuffle(positions);
        
        let removedCount = 0;
        let attempts = 0;
        const maxAttempts = positions.length;
        
        // Try to remove cells one by one
        for (let i = 0; i < positions.length && removedCount < cellsToRemove && attempts < maxAttempts; i++) {
            const [row, col] = positions[i];
            attempts++;
            
            // Skip if already empty
            if (puzzle[row][col] === 0) continue;
            
            // Save the value
            const temp = puzzle[row][col];
            
            // Try removing it
            puzzle[row][col] = 0;
            
            // Check if puzzle still has unique solution
            if (this.hasUniqueSolution(puzzle)) {
                // Keep it removed
                removedCount++;
            } else {
                // Restore the value
                puzzle[row][col] = temp;
            }
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
