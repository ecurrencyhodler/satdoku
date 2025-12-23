import { useEffect } from 'react';

/**
 * Hook for handling keyboard input events
 */
export function useKeyboardInput(
  gameState,
  selectedCell,
  setSelectedCell,
  gameStateRef,
  handleCellInput,
  noteMode,
  onToggleNoteMode
) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameState?.gameInProgress) return;

      // Don't interfere with text input fields
      const target = e.target;
      const isInputElement = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Check if selected cell is locked (prefilled or correctly filled)
      let isSelectedCellLocked = false;
      if (selectedCell && gameState) {
        const row = selectedCell.row;
        const col = selectedCell.col;
        const currentValue = gameState.board?.[row]?.[col] ?? 0;
        const isPrefilled = gameState.puzzle?.[row]?.[col] !== 0;
        const isIncorrect = !isPrefilled && currentValue !== 0 && gameState.solution && gameState.solution[row]?.[col] !== 0 && currentValue !== gameState.solution[row]?.[col];
        isSelectedCellLocked = isPrefilled || (currentValue !== 0 && !isIncorrect);
      }

      // Toggle note mode with 'N' key
      if ((e.key === 'n' || e.key === 'N') && !isInputElement) {
        if (onToggleNoteMode) {
          e.preventDefault();
          onToggleNoteMode();
        }
      } else if (e.key >= '1' && e.key <= '9') {
        // Don't process number input if cell is locked
        if (selectedCell && !isInputElement && !isSelectedCellLocked) {
          e.preventDefault();
          handleCellInput(parseInt(e.key));
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        // Don't process clear input if cell is locked
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
  }, [gameState, selectedCell, setSelectedCell, handleCellInput, noteMode, onToggleNoteMode]);
}
