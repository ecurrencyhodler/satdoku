import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook for managing GamePage event handlers
 */
export function useGamePageHandlers(
  gameStateRef,
  livesManagerRef,
  gameControllerRef,
  pendingDifficultyChange,
  setPendingDifficultyChange,
  setSelectedCell,
  setShowNewGameModal,
  updateGameState,
  startNewGame,
  isMobile,
  mobileInputRef
) {
  const router = useRouter();

  const handleCellClick = useCallback((row, col) => {
    if (!livesManagerRef.current.hasLives()) return;
    setSelectedCell({ row, col });
    
    // Focus mobile input immediately on click (must be in user interaction handler)
    if (isMobile && mobileInputRef?.current) {
      // Use requestAnimationFrame to ensure it happens in the same event loop
      requestAnimationFrame(() => {
        mobileInputRef.current?.focus();
      });
    }
  }, [livesManagerRef, setSelectedCell, isMobile, mobileInputRef]);

  const handleDifficultyChange = useCallback((newDifficulty) => {
    if (gameStateRef.current.gameInProgress) {
      setPendingDifficultyChange(newDifficulty);
      setShowNewGameModal(true);
    } else {
      gameStateRef.current.currentDifficulty = newDifficulty;
      updateGameState();
    }
  }, [gameStateRef, setPendingDifficultyChange, setShowNewGameModal, updateGameState]);

  const handleNewGameClick = useCallback(() => {
    if (gameStateRef.current.gameInProgress) {
      setShowNewGameModal(true);
    } else {
      startNewGame();
    }
  }, [gameStateRef, setShowNewGameModal, startNewGame]);

  const handlePurchaseSuccess = useCallback(() => {
    // Life will be added via URL param on return
    router.push('/?payment_success=true');
  }, [router]);

  const handlePurchaseClose = useCallback((closePurchaseModal) => {
    // Only show game over if user cancels and still has 0 lives
    // If they purchased a life, they should be able to continue playing
    if (!livesManagerRef.current.hasLives()) {
      const stats = gameControllerRef.current?.getGameStats();
      closePurchaseModal(true, stats);
    } else {
      // User has lives, just close the purchase modal without showing game over
      closePurchaseModal(false);
    }
  }, [gameControllerRef, livesManagerRef]);

  return {
    handleCellClick,
    handleDifficultyChange,
    handleNewGameClick,
    handlePurchaseSuccess,
    handlePurchaseClose,
  };
}
