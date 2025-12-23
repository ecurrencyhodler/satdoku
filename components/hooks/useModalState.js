import { useState } from 'react';

/**
 * Hook for managing all modal states
 */
export function useModalState() {
  const [showWinModal, setShowWinModal] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showScoreSubmissionSuccessModal, setShowScoreSubmissionSuccessModal] = useState(false);
  const [showNameInputModal, setShowNameInputModal] = useState(false);
  const [showKeepPlayingModal, setShowKeepPlayingModal] = useState(false);
  const [showDifficultySelectionModal, setShowDifficultySelectionModal] = useState(false);
  const [winStats, setWinStats] = useState(null);
  const [gameOverStats, setGameOverStats] = useState(null);
  const [pendingScoreData, setPendingScoreData] = useState(null);

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

  const openScoreSubmissionSuccessModal = () => {
    setShowScoreSubmissionSuccessModal(true);
  };

  const openNameInputModal = (sessionId, score) => {
    setPendingScoreData({ sessionId, score });
    setShowNameInputModal(true);
  };

  const closeNameInputModal = () => {
    setShowNameInputModal(false);
    setPendingScoreData(null);
  };

  const openKeepPlayingModal = () => {
    setShowKeepPlayingModal(true);
  };

  const closeKeepPlayingModal = () => {
    setShowKeepPlayingModal(false);
  };

  const openDifficultySelectionModal = () => {
    setShowDifficultySelectionModal(true);
  };

  const closeDifficultySelectionModal = () => {
    setShowDifficultySelectionModal(false);
  };

  return {
    showWinModal,
    showGameOverModal,
    showNewGameModal,
    showPurchaseModal,
    showScoreSubmissionSuccessModal,
    showNameInputModal,
    showKeepPlayingModal,
    showDifficultySelectionModal,
    winStats,
    gameOverStats,
    pendingScoreData,
    setShowWinModal,
    setShowGameOverModal,
    setShowNewGameModal,
    setShowPurchaseModal,
    setShowScoreSubmissionSuccessModal,
    setShowNameInputModal,
    setShowKeepPlayingModal,
    setShowDifficultySelectionModal,
    openWinModal,
    openGameOverModal,
    openPurchaseModal,
    openScoreSubmissionSuccessModal,
    openNameInputModal,
    openKeepPlayingModal,
    openDifficultySelectionModal,
    closeNameInputModal,
    closePurchaseModal,
    closeKeepPlayingModal,
    closeDifficultySelectionModal,
  };
}
