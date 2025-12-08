import { BOARD_SIZE } from '../system/constants.js';
import { UIAnimations } from '../ui/uiAnimations.js';
import { StateManager } from '../system/localState.js';
import { ScoreAnimationHandler } from '../ui/scoreAnimationHandler.js';

// Game controller for move processing and win/loss conditions
export class GameController {
    constructor(gameState, validator, scoringEngine, livesManager) {
        this.gameState = gameState;
        this.validator = validator;
        this.scoringEngine = scoringEngine;
        this.livesManager = livesManager;
        this.purchaseModalTriggered = false; // Flag to prevent duplicate modal triggers
    }

    // Process a cell input by coordinates (for React usage)
    processCellInputByCoords(row, col, value, onStateChange, onWin, onGameOver, onPurchaseLife, getCellElement) {
        // Don't allow input if no lives remaining
        if (!this.livesManager.hasLives()) {
            return;
        }
        
        // Don't allow editing prefilled cells
        if (this.gameState.currentPuzzle[row][col] !== 0) {
            return;
        }
        
        // Clear cell if value is 0
        if (value === 0) {
            this.gameState.currentBoard[row][col] = 0;
            onStateChange();
            return;
        }
        
        // Check if move is valid
        const isValid = this.validator.isValidMove(this.gameState.currentBoard, row, col, value);
        
        const cellElement = getCellElement ? getCellElement(row, col) : null;
        
        if (isValid) {
            this.handleCorrectMove(cellElement, row, col, value, onStateChange, onWin);
        } else {
            this.handleIncorrectMove(cellElement, onStateChange, onGameOver, onPurchaseLife);
        }
    }

    // Handle a correct move
    handleCorrectMove(cellElement, row, col, value, onStateChange, onWin) {
        // Update board
        this.gameState.currentBoard[row][col] = value;
        
        // Process scoring
        const scoreEvents = this.scoringEngine.processMove(this.gameState.currentBoard, row, col);
        
        // Show score animations if cell element is available
        if (cellElement) {
            ScoreAnimationHandler.showScoreAnimations(scoreEvents, cellElement);
        }
        
        onStateChange();
        
        // Check for win condition
        if (this.isPuzzleComplete()) {
            onWin();
        }
    }

    // Handle an incorrect move
    handleIncorrectMove(cellElement, onStateChange, onGameOver, onPurchaseLife) {
        // Flash error if cell element is available
        if (cellElement) {
            UIAnimations.flashError(cellElement);
        }
        this.gameState.mistakes++;
        const remainingLives = this.livesManager.loseLife();
        
        onStateChange();
        
        // When lives reach 0, show purchase modal (only once)
        if (remainingLives === 0 && !this.purchaseModalTriggered) {
            this.purchaseModalTriggered = true;
            if (onPurchaseLife && typeof onPurchaseLife === 'function') {
                onPurchaseLife();
            } else {
                console.error('onPurchaseLife callback is not defined or is not a function');
            }
        }
    }

    // Check if puzzle is complete
    isPuzzleComplete() {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.gameState.currentBoard[row][col] === 0) {
                    return false;
                }
            }
        }
        return true;
    }

    // Get game stats for win/loss screens
    getGameStats() {
        return {
            score: this.scoringEngine.getScore(),
            moves: this.scoringEngine.getMoves(),
            mistakes: this.gameState.mistakes,
            livesPurchased: this.livesManager.getLivesPurchased()
        };
    }

    // End game (clear state)
    endGame() {
        this.gameState.gameInProgress = false;
        StateManager.clearGameState();
    }

    // Reset purchase modal trigger flag (call when life is added or new game starts)
    resetPurchaseModalTrigger() {
        this.purchaseModalTriggered = false;
    }
}

