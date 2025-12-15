import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StateManager } from '../../src/js/system/localState.js';

/**
 * Hook for managing GamePage event handlers
 * Now uses server-authoritative actions
 */
export function useGamePageHandlers(
  gameState,
  pendingDifficultyChange,
  setPendingDifficultyChange,
  setSelectedCell,
  setShowNewGameModal,
  startNewGame,
  isMobile,
  mobileInputRef,
  setGameState
) {
  const router = useRouter();

  const handleCellClick = useCallback((row, col) => {
    // Allow clicking on any cell for highlighting
    // Input processing will be handled by useCellInput hook
    setSelectedCell({ row, col });
    
    // Focus mobile input immediately on click (must be in user interaction handler)
    // Must be synchronous for mobile browsers to allow focus
    if (isMobile && mobileInputRef?.current) {
      try {
        // Focus immediately - mobile browsers require this to be synchronous
        mobileInputRef.current.focus();
        // Also try click to ensure it's triggered
        mobileInputRef.current.click();
      } catch (e) {
        console.error('Error focusing mobile input:', e);
      }
    }
  }, [setSelectedCell, isMobile, mobileInputRef]);

  const handleDifficultyChange = useCallback((newDifficulty) => {
    if (gameState && gameState.gameInProgress) {
      setPendingDifficultyChange(newDifficulty);
      setShowNewGameModal(true);
    } else {
      // Start new game with new difficulty
      startNewGame(newDifficulty);
    }
  }, [gameState, setPendingDifficultyChange, setShowNewGameModal, startNewGame]);

  const handleNewGameClick = useCallback(() => {
    if (gameState && gameState.gameInProgress) {
      setShowNewGameModal(true);
    } else {
      startNewGame();
    }
  }, [gameState, setShowNewGameModal, startNewGame]);

  const handleKeepPlaying = useCallback(async () => {
    try {
      const result = await StateManager.sendGameAction({ action: 'keepPlaying' }, gameState?.version);
      
      if (result.success) {
        // Transform server state to client format
        const transformedState = {
          board: result.state.currentBoard,
          puzzle: result.state.currentPuzzle,
          difficulty: result.state.difficulty,
          mistakes: result.state.mistakes,
          gameInProgress: result.state.gameInProgress,
          score: result.state.score,
          moves: result.state.moves,
          lives: result.state.lives,
          livesPurchased: result.state.livesPurchased || 0,
          completedRows: result.state.completedRows || [],
          completedColumns: result.state.completedColumns || [],
          completedBoxes: result.state.completedBoxes || [],
          version: result.state.version
        };
        setGameState(transformedState);
        setSelectedCell(null);
      } else {
        console.error('[useGamePageHandlers] Failed to keep playing:', result.error);
      }
    } catch (error) {
      console.error('[useGamePageHandlers] Error keeping playing:', error);
    }
  }, [gameState, setGameState, setSelectedCell]);

  const handlePurchaseLife = useCallback(async (paymentSessionId) => {
    try {
      const result = await StateManager.sendGameAction({ 
        action: 'purchaseLife', 
        paymentSessionId 
      }, gameState?.version);
      
      if (result.success) {
        setGameState(result.state);
      } else {
        console.error('[useGamePageHandlers] Failed to purchase life:', result.error);
      }
    } catch (error) {
      console.error('[useGamePageHandlers] Error purchasing life:', error);
    }
  }, [gameState, setGameState]);

  const handlePurchaseSuccess = useCallback(() => {
    // Life will be added via URL param on return
    router.push('/?payment_success=true');
  }, [router]);

  const handlePurchaseClose = useCallback((closePurchaseModal) => {
    // Only show game over if user cancels and still has 0 lives
    // If they purchased a life, they should be able to continue playing
    if (gameState && gameState.lives <= 0) {
      const stats = {
        score: gameState.score,
        moves: gameState.moves,
        mistakes: gameState.mistakes,
        livesPurchased: gameState.livesPurchased
      };
      closePurchaseModal(true, stats);
    } else {
      // User has lives, just close the purchase modal without showing game over
      closePurchaseModal(false);
    }
  }, [gameState]);

  return {
    handleCellClick,
    handleDifficultyChange,
    handleNewGameClick,
    handleKeepPlaying,
    handlePurchaseLife,
    handlePurchaseSuccess,
    handlePurchaseClose,
  };
}
