'use client';

import WinModal from './Modals/WinModal';
import GameOverModal from './Modals/GameOverModal';
import NewGameModal from './Modals/NewGameModal';
import PurchaseLifeModal from './PurchaseLifeModal';

/**
 * Component that renders all game modals
 */
export default function GameModals({
  showWinModal,
  showGameOverModal,
  showNewGameModal,
  showPurchaseModal,
  winStats,
  gameOverStats,
  setShowWinModal,
  setShowGameOverModal,
  setShowNewGameModal,
  startNewGame,
  pendingDifficultyChange,
  setPendingDifficultyChange,
  handlePurchaseClose,
  handlePurchaseSuccess,
  closePurchaseModal,
}) {
  return (
    <>
      <WinModal
        isOpen={showWinModal}
        onClose={() => setShowWinModal(false)}
        onPlayAgain={() => {
          setShowWinModal(false);
          startNewGame();
        }}
        onChangeDifficulty={() => {
          setShowWinModal(false);
          startNewGame();
        }}
        stats={winStats || { score: 0, moves: 0, mistakes: 0, livesPurchased: 0 }}
      />

      <GameOverModal
        isOpen={showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        onRestart={() => {
          setShowGameOverModal(false);
          startNewGame();
        }}
        onChangeDifficulty={() => {
          setShowGameOverModal(false);
          startNewGame();
        }}
        stats={gameOverStats || { score: 0, moves: 0, mistakes: 0 }}
      />

      <NewGameModal
        isOpen={showNewGameModal}
        onClose={() => {
          setShowNewGameModal(false);
          setPendingDifficultyChange(null);
        }}
        onConfirm={() => {
          setShowNewGameModal(false);
          startNewGame();
        }}
      />

      <PurchaseLifeModal
        isOpen={showPurchaseModal}
        onClose={() => handlePurchaseClose(closePurchaseModal)}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}

