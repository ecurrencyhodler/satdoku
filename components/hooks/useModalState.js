import { useState } from 'react';

/**
 * Hook for managing all modal states
 */
export function useModalState() {
  const [showWinModal, setShowWinModal] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [winStats, setWinStats] = useState(null);
  const [gameOverStats, setGameOverStats] = useState(null);

  const openWinModal = (stats) => {
    setWinStats(stats);
    setShowWinModal(true);
  };

  const openGameOverModal = (stats) => {
    setGameOverStats(stats);
    setShowGameOverModal(true);
  };

  const openPurchaseModal = () => {
    // Prevent opening if already open
    setShowPurchaseModal(prev => {
      if (prev) {
        console.log('Purchase modal already open, skipping duplicate open');
        return prev;
      }
      console.log('Opening purchase modal');
      return true;
    });
  };

  const closePurchaseModal = (showGameOver = false, gameOverStats = null) => {
    setShowPurchaseModal(false);
    if (showGameOver && gameOverStats) {
      openGameOverModal(gameOverStats);
    }
  };

  return {
    showWinModal,
    showGameOverModal,
    showNewGameModal,
    showPurchaseModal,
    winStats,
    gameOverStats,
    setShowWinModal,
    setShowGameOverModal,
    setShowNewGameModal,
    setShowPurchaseModal,
    openWinModal,
    openGameOverModal,
    openPurchaseModal,
    closePurchaseModal,
  };
}
