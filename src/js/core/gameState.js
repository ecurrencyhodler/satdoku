import { StateManager } from '../system/localState.js';
import { DIFFICULTY_LEVELS } from '../system/constants.js';

// Game state management
export class GameState {
    constructor() {
        this.currentPuzzle = null;
        this.currentSolution = null;
        this.currentBoard = null;
        this.currentDifficulty = 'beginner';
        this.mistakes = 0;
        this.gameInProgress = false;
        this.currentVersion = null; // Track version for optimistic locking
    }

    // Load game state from Redis (with localStorage fallback)
    async loadState(scoringEngine, livesManager) {
        const saved = await StateManager.loadGameState();
        // Validate all required fields are present
        if (saved && 
            saved.currentBoard && 
            saved.currentSolution && 
            saved.currentPuzzle &&
            Array.isArray(saved.currentBoard) &&
            Array.isArray(saved.currentSolution) &&
            Array.isArray(saved.currentPuzzle)) {
            this.currentPuzzle = saved.currentPuzzle;
            this.currentSolution = saved.currentSolution;
            this.currentBoard = saved.currentBoard;
            this.currentDifficulty = saved.difficulty || 'beginner';
            this.mistakes = saved.mistakes || 0;
            this.gameInProgress = true;
            
            // Restore scoring engine state
            scoringEngine.score = saved.score || 0;
            scoringEngine.moves = saved.moves || 0;
            if (saved.completedRows) {
                scoringEngine.completedRows = new Set(saved.completedRows);
            } else {
                scoringEngine.completedRows = new Set();
            }
            if (saved.completedColumns) {
                scoringEngine.completedColumns = new Set(saved.completedColumns);
            } else {
                scoringEngine.completedColumns = new Set();
            }
            if (saved.completedBoxes) {
                scoringEngine.completedBoxes = new Set(saved.completedBoxes);
            } else {
                scoringEngine.completedBoxes = new Set();
            }
            
            // Restore lives manager state
            livesManager.lives = saved.lives || 1;
            livesManager.livesPurchased = saved.livesPurchased || 0;
            
            // Store version for optimistic locking
            this.currentVersion = saved.version ?? null;
            
            return true;
        }
        return false;
    }

    // Save game state to Redis (with localStorage fallback)
    async saveState(scoringEngine, livesManager) {
        const state = {
            currentPuzzle: this.currentPuzzle,
            currentSolution: this.currentSolution,
            currentBoard: this.currentBoard,
            difficulty: this.currentDifficulty,
            mistakes: this.mistakes,
            score: scoringEngine.getScore(),
            moves: scoringEngine.getMoves(),
            lives: livesManager.getLives(),
            livesPurchased: livesManager.getLivesPurchased(),
            completedRows: Array.from(scoringEngine.completedRows),
            completedColumns: Array.from(scoringEngine.completedColumns),
            completedBoxes: Array.from(scoringEngine.completedBoxes)
        };
        const result = await StateManager.saveGameState(state, this.currentVersion);
        
        // Update version if save was successful
        if (result.success && result.version !== undefined) {
            this.currentVersion = result.version;
        }
        
        return result;
    }

    // Initialize new game state
    initializeNewGame(puzzle, solution, difficulty) {
        this.currentPuzzle = puzzle;
        this.currentSolution = solution;
        this.currentBoard = puzzle.map(row => [...row]);
        this.currentDifficulty = difficulty;
        this.mistakes = 0;
        this.gameInProgress = true;
        this.currentVersion = null; // Reset version for new game
    }

    // Reset game state
    reset() {
        this.currentPuzzle = null;
        this.currentSolution = null;
        this.currentBoard = null;
        this.mistakes = 0;
        this.gameInProgress = false;
    }

    // Get difficulty config
    getDifficultyConfig() {
        return DIFFICULTY_LEVELS[this.currentDifficulty];
    }
}

