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
  onPurchaseLife,
  isLoadingState
) {
  const handleCellInput = useCallback((value) => {
    // Prevent input during state reload (e.g., after purchase)
    if (isLoadingState?.current) {
      console.warn('[useCellInput] Input blocked - state is currently loading');
      return;
    }
    
    if (!selectedCell || !gameControllerRef.current) return;

    const row = selectedCell.row;
    const col = selectedCell.col;

    // Helper to get cell element for animations
    const getCellElement = (r, c) => {
      return document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    };

    // Wrap callbacks to include state updates
    const onStateChange = async () => {
      updateGameState();
      // Await save to ensure it completes and handle errors
      try {
        await saveGameState();
      } catch (error) {
        console.error('[useCellInput] Failed to save game state:', error);
      }
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
  }, [selectedCell, gameStateRef, gameControllerRef, updateGameState, saveGameState, onWin, onGameOver, onPurchaseLife, isLoadingState]);

  return { handleCellInput };
}
