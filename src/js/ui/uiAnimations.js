// UI animation helpers
export class UIAnimations {
    // Show score popup animation
    static showScorePopup(element, score, type = 'cell') {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${score}`;

        // Position relative to cell
        const rect = element.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top + rect.height / 2}px`;
        popup.style.transform = 'translate(-50%, -50%)';

        document.body.appendChild(popup);

        // Remove after animation
        setTimeout(() => {
            popup.remove();
        }, 300);
    }

    // Flash cell red for error
    static flashError(cell) {
        cell.classList.add('cell-error');
        setTimeout(() => {
            cell.classList.remove('cell-error');
        }, 300);
    }

    // Get the game board element
    static getGameBoard() {
        return document.getElementById('game-board');
    }
}

