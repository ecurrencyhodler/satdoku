import { UIAnimations } from './uiAnimations.js';

/**
 * Handles score animation logic for game events
 */
export class ScoreAnimationHandler {
    /**
     * Show score animations for a list of score events
     * @param {Array} scoreEvents - Array of score event objects
     * @param {HTMLElement} cellElement - The cell element that triggered the score
     */
    static showScoreAnimations(scoreEvents, cellElement) {
        const board = UIAnimations.getGameBoard();
        
        scoreEvents.forEach(event => {
            if (event.type === 'cell') {
                UIAnimations.showScorePopup(cellElement, event.score);
            } else if (event.type === 'row') {
                // Show popup on first cell of row
                // Note: Row completion styling is handled by React via Cell component props
                if (board) {
                    const firstCell = board.querySelector(`[data-row="${event.row}"][data-col="0"]`);
                    if (firstCell) {
                        UIAnimations.showScorePopup(firstCell, event.score);
                    }
                }
            } else if (event.type === 'column') {
                // Show popup on first cell of column
                // Note: Column completion styling is handled by React via Cell component props
                if (board) {
                    const firstCell = board.querySelector(`[data-row="0"][data-col="${event.column}"]`);
                    if (firstCell) {
                        UIAnimations.showScorePopup(firstCell, event.score);
                    }
                }
            } else if (event.type === 'box') {
                // Show popup on first cell of box
                // Note: Box completion styling is handled by React via Cell component props
                if (board) {
                    const boxRow = Math.floor(event.boxIndex / 3) * 3;
                    const boxCol = (event.boxIndex % 3) * 3;
                    const firstCell = board.querySelector(`[data-row="${boxRow}"][data-col="${boxCol}"]`);
                    if (firstCell) {
                        UIAnimations.showScorePopup(firstCell, event.score);
                    }
                }
            }
        });
    }
}
