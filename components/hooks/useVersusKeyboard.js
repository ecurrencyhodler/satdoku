import { useEffect } from 'react';

/**
 * Hook for handling keyboard input in versus mode
 * @param {object} options - Configuration options
 * @param {object} options.gameState - Current game state
 * @param {object} options.selectedCell - Currently selected cell
 * @param {function} options.setSelectedCell - Function to set selected cell
 * @param {function} options.handleCellInput - Function to handle cell input
 * @param {boolean} options.noteMode - Whether note mode is active
 * @param {function} options.setNoteMode - Function to toggle note mode
 * @param {boolean} options.isMobile - Whether on mobile device
 * @param {boolean} options.isSpectator - Whether user is a spectator
 */
export function useVersusKeyboard({
  gameState,
  selectedCell,
  setSelectedCell,
  handleCellInput,
  noteMode,
  setNoteMode,
  isMobile,
  isSpectator
}) {
  useEffect(() => {
    // Only enable keyboard input on desktop (not mobile)
    if (isMobile || isSpectator) return;

    const handleKeyDown = (e) => {
      const currentStatus = gameState?.status || gameState?.gameStatus;
      // Only handle keyboard input when game is active/playing
      if (currentStatus !== 'active' && currentStatus !== 'playing') return;

      // Don't interfere with text input fields
      const target = e.target;
      const isInputElement = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Check if selected cell is locked (prefilled)
      let isSelectedCellLocked = false;
      if (selectedCell && gameState) {
        const row = selectedCell.row;
        const col = selectedCell.col;
        const isPrefilled = gameState.puzzle?.[row]?.[col] !== 0;
        isSelectedCellLocked = isPrefilled;
      }

      // Toggle note mode with 'N' key
      if ((e.key === 'n' || e.key === 'N') && !isInputElement) {
        e.preventDefault();
        setNoteMode(prev => !prev);
      } else if (e.key >= '1' && e.key <= '9') {
        // Don't process number input if cell is locked or no cell selected
        if (selectedCell && !isInputElement && !isSelectedCellLocked) {
          e.preventDefault();
          handleCellInput(parseInt(e.key));
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        // Don't process clear input if cell is locked or no cell selected
        if (selectedCell && !isInputElement && !isSelectedCellLocked) {
          e.preventDefault();
          handleCellInput(0);
        }
      } else if (e.key.startsWith('Arrow')) {
        // Only handle arrow keys if a cell is already selected and not in an input field
        if (!selectedCell || isInputElement) {
          return;
        }

        e.preventDefault();

        let newRow = selectedCell.row;
        let newCol = selectedCell.col;

        switch (e.key) {
          case 'ArrowUp':
            newRow = Math.max(0, newRow - 1);
            break;
          case 'ArrowDown':
            newRow = Math.min(8, newRow + 1);
            break;
          case 'ArrowLeft':
            newCol = Math.max(0, newCol - 1);
            break;
          case 'ArrowRight':
            newCol = Math.min(8, newCol + 1);
            break;
        }

        setSelectedCell({ row: newRow, col: newCol });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedCell, setSelectedCell, handleCellInput, noteMode, setNoteMode, isMobile, isSpectator]);
}
