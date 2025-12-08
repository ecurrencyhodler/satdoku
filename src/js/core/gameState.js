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
    }

    // Load game state from localStorage
    loadState(scoringEngine, livesManager) {
        const saved = StateManager.loadGameState();
        if (saved && saved.currentBoard && saved.currentSolution) {
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
            }
            if (saved.completedBoxes) {
                scoringEngine.completedBoxes = new Set(saved.completedBoxes);
            }
            
            // Restore lives manager state
            livesManager.lives = saved.lives || 1;
            livesManager.livesPurchased = saved.livesPurchased || 0;
            
            return true;
        }
        return false;
    }

    // Save game state to localStorage
    saveState(scoringEngine, livesManager) {
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
            completedBoxes: Array.from(scoringEngine.completedBoxes)
        };
        StateManager.saveGameState(state);
    }

    // Initialize new game state
    initializeNewGame(puzzle, solution, difficulty) {
        this.currentPuzzle = puzzle;
        this.currentSolution = solution;
        this.currentBoard = puzzle.map(row => [...row]);
        this.currentDifficulty = difficulty;
        this.mistakes = 0;
        this.gameInProgress = true;
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

