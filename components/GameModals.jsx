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
  gameState,
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
          // Use current difficulty from gameState when starting new game
          const difficultyToUse = pendingDifficultyChange || gameState?.difficulty || 'beginner';
          startNewGame(difficultyToUse);
          setPendingDifficultyChange(null);
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
        onSelectDifficulty={(difficulty) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameModals.jsx:173','message':'DifficultySelectionModal onSelectDifficulty called','data':{difficulty,hasGameState:!!gameState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Close modal first
          setShowDifficultySelectionModal(false);
          // If gameState exists, use keepPlayingWithDifficulty, otherwise startNewGame
          if (gameState) {
            onKeepPlayingWithDifficulty(difficulty).catch(err => {
              console.error('[GameModals] Error in onKeepPlayingWithDifficulty:', err);
            });
          } else {
            startNewGame(difficulty);
          }
        }}
      />
    </>
  );
}





















