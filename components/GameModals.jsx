'use client';

import WinModal from './Modals/WinModal';
import GameOverModal from './Modals/GameOverModal';
import NewGameModal from './Modals/NewGameModal';
import PurchaseLifeModal from './PurchaseLifeModal';
import ScoreSubmissionSuccessModal from './Modals/ScoreSubmissionSuccessModal';
import NameInputModal from './Modals/NameInputModal';
import KeepPlayingModal from './Modals/KeepPlayingModal';
import DifficultySelectionModal from './Modals/DifficultySelectionModal';
import { StateManager } from '../src/js/system/localState.js';

/**
 * Component that renders all game modals
 */
export default function GameModals({
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
  setShowScoreSubmissionSuccessModal,
  setShowNameInputModal,
  setShowKeepPlayingModal,
  setShowDifficultySelectionModal,
  startNewGame,
  onKeepPlaying,
  onKeepPlayingWithDifficulty,
  onShowDifficultySelection,
  pendingDifficultyChange,
  setPendingDifficultyChange,
  handlePurchaseClose,
  handlePurchaseSuccess,
  closePurchaseModal,
  openScoreSubmissionSuccessModal,
  openNameInputModal,
  closeNameInputModal,
  completionId,
  qualifiedForLeaderboard,
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
        onKeepPlaying={onKeepPlaying}
        onShowDifficultySelection={() => {
          setShowWinModal(false);
          onShowDifficultySelection();
        }}
        onChangeDifficulty={() => {
          setShowWinModal(false);
          startNewGame();
        }}
        onEndGame={() => {
          setShowWinModal(false);
          startNewGame();
        }}
        onScoreSubmitted={openScoreSubmissionSuccessModal}
        onOpenNameInput={openNameInputModal}
        onScoreNotHighEnough={() => setShowKeepPlayingModal(true)}
        stats={winStats || { score: 0, moves: 0, mistakes: 0, livesPurchased: 0 }}
        completionId={completionId}
        qualifiedForLeaderboard={qualifiedForLeaderboard}
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

      <ScoreSubmissionSuccessModal
        isOpen={showScoreSubmissionSuccessModal}
        onClose={() => setShowScoreSubmissionSuccessModal(false)}
        onViewLeaderboard={() => {
          window.open('/leaderboard', '_blank');
        }}
      />

      <NameInputModal
        isOpen={showNameInputModal}
        onClose={closeNameInputModal}
        onSubmit={async (username, completionId) => {
          try {
            const response = await fetch('/api/leaderboard', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include', // Include cookies
              body: JSON.stringify({ completionId, username }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Failed to submit score');
            }

            if (data.success) {
              // Clear game state after successful score submission so refresh starts new game
              await StateManager.clearGameState();
              closeNameInputModal();
              openScoreSubmissionSuccessModal();
            } else {
              throw new Error(data.message || 'Failed to submit score');
            }
          } catch (error) {
            throw error;
          }
        }}
        completionId={pendingScoreData?.completionId}
      />

      <KeepPlayingModal
        isOpen={showKeepPlayingModal}
        onClose={() => setShowKeepPlayingModal(false)}
        onKeepPlaying={onKeepPlaying}
        onShowDifficultySelection={onShowDifficultySelection}
        onEndGame={() => {
          setShowKeepPlayingModal(false);
          startNewGame();
        }}
      />

      <DifficultySelectionModal
        isOpen={showDifficultySelectionModal}
        onClose={() => setShowDifficultySelectionModal(false)}
        onSelectDifficulty={onKeepPlayingWithDifficulty}
      />
    </>
  );
}





















