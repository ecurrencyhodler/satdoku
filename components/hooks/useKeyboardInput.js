import { useEffect } from 'react';

/**
 * Hook for handling keyboard input events
 */
export function useKeyboardInput(
  gameState,
  selectedCell,
  setSelectedCell,
  gameStateRef,
  handleCellInput
) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameState?.gameInProgress) return;

      if (e.key >= '1' && e.key <= '9') {
        handleCellInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleCellInput(0);
      } else if (e.key.startsWith('Arrow')) {
        if (!selectedCell) {
          // Select first editable cell
          for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
              if (gameStateRef.current.currentPuzzle[row][col] === 0) {
                setSelectedCell({ row, col });
                return;
              }
            }
          }
          return;
        }

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
  }, [gameState, selectedCell, setSelectedCell, gameStateRef, handleCellInput]);
}
