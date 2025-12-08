import { useCallback } from 'react';

/**
 * Hook for handling cell input processing logic
 * Delegates to GameController to avoid duplicating logic
 */
export function useCellInput(
  selectedCell,
  gameStateRef,
  gameControllerRef,
  updateGameState,
  saveGameState,
  onWin,
  onGameOver,
  onPurchaseLife
) {
  const handleCellInput = useCallback((value) => {
    if (!selectedCell || !gameControllerRef.current) return;

    const row = selectedCell.row;
    const col = selectedCell.col;

    // Helper to get cell element for animations
    const getCellElement = (r, c) => {
      return document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    };

    // Wrap callbacks to include state updates
    const onStateChange = () => {
      updateGameState();
      saveGameState();
    };

    const onWinWithStats = () => {
      const stats = gameControllerRef.current.getGameStats();
      gameControllerRef.current.endGame();
      onWin(stats);
      updateGameState();
    };

    // Delegate to gameController
    gameControllerRef.current.processCellInputByCoords(
      row,
      col,
      value,
      onStateChange,
      onWinWithStats,
      onGameOver,
      onPurchaseLife,
      getCellElement
    );
  }, [selectedCell, gameStateRef, gameControllerRef, updateGameState, saveGameState, onWin, onGameOver, onPurchaseLife]);

  return { handleCellInput };
}
