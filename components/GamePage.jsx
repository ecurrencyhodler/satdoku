'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useCellInput } from './hooks/useCellInput';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useModalState } from './hooks/useModalState';
import { useGamePageHandlers } from './hooks/useGamePageHandlers';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useMobileInput } from './hooks/useMobileInput';
import GameBoard from './GameBoard';
import StatsBar from './StatsBar';
import GameControls from './GameControls';
import GameModals from './GameModals';
import GamePageHeader from './GamePageHeader';
import GamePageLayout from './GamePageLayout';
import TutorChat from './TutorChat';

export default function GamePage() {
  const [gameState, setGameState] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [pendingDifficultyChange, setPendingDifficultyChange] = useState(null);
  
  // Mobile detection
  const isMobile = useMobileDetection();

  // Modal state hook - must come first so setShowPurchaseModal is available
  const {
    showWinModal,
    showGameOverModal,
    showNewGameModal,
    showPurchaseModal,
    showScoreSubmissionSuccessModal,
    showNameInputModal,
    showKeepPlayingModal,
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
    openWinModal,
    openGameOverModal,
    openPurchaseModal,
    openScoreSubmissionSuccessModal,
    openNameInputModal,
    closeNameInputModal,
    closePurchaseModal,
  } = useModalState();

  // Store completionId and qualification status
  const [completionId, setCompletionId] = useState(null);
  const [qualifiedForLeaderboard, setQualifiedForLeaderboard] = useState(false);

  // Game initialization hook
  const {
    startNewGame: startNewGameFromHook,
    resetBoardKeepStats,
    isLoadingState,
  } = useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal);

  // Wrapper for startNewGame that handles pending difficulty change
  const startNewGame = useCallback(() => {
    startNewGameFromHook(pendingDifficultyChange);
    setPendingDifficultyChange(null);
    setCompletionId(null);
    setQualifiedForLeaderboard(false);
  }, [startNewGameFromHook, pendingDifficultyChange, setPendingDifficultyChange]);

  // Stable callbacks for game events
  const handleWin = useCallback((stats) => {
    openWinModal(stats);
    // Completion is now handled server-side, no need to save here
  }, [openWinModal]);

  const handleGameOver = useCallback((stats) => {
    if (stats) {
      openGameOverModal(stats);
    }
  }, [openGameOverModal]);

  const handlePurchaseLife = useCallback(() => {
    console.log('Opening purchase modal');
    openPurchaseModal();
  }, [openPurchaseModal]);

  const handleKeepPlaying = useCallback(async () => {
    // Close the modal
    setShowWinModal(false);
    // Reset the board while preserving stats (server action)
    await resetBoardKeepStats();
  }, [setShowWinModal, resetBoardKeepStats]);

  // Cell input hook
  const { handleCellInput } = useCellInput(
    selectedCell,
    gameState,
    setGameState,
    handleWin,
    handleGameOver,
    handlePurchaseLife,
    setCompletionId,
    setQualifiedForLeaderboard,
    isLoadingState
  );

  // Keyboard input hook
  useKeyboardInput(
    gameState,
    selectedCell,
    setSelectedCell,
    null, // gameStateRef no longer needed
    handleCellInput
  );

  // Mobile input handling (must come before useGamePageHandlers)
  const { mobileInputRef, handleMobileInput, handleMobileKeyDown } = useMobileInput(
    isMobile,
    selectedCell,
    handleCellInput
  );

  // Event handlers hook
  const {
    handleCellClick,
    handleDifficultyChange,
    handleNewGameClick,
    handleKeepPlaying: handleKeepPlayingFromHandler,
    handlePurchaseLife: handlePurchaseLifeFromHandler,
    handlePurchaseSuccess,
    handlePurchaseClose,
  } = useGamePageHandlers(
    gameState,
    pendingDifficultyChange,
    setPendingDifficultyChange,
    setSelectedCell,
    setShowNewGameModal,
    startNewGame,
    isMobile,
    mobileInputRef,
    setGameState
  );

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#game-board') && 
          !e.target.closest('.modal') &&
          !e.target.closest('.howie-logo') &&
          !e.target.closest('.tutor-chat-panel') &&
          e.target.id !== 'new-game-btn' &&
          e.target.id !== 'difficulty' &&
          e.target.id !== 'mobile-number-input') {
        setSelectedCell(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [setSelectedCell]);

  if (!gameState) {
    return <div>Loading...</div>;
  }

  return (
    <GamePageLayout>
      <GamePageHeader
        gameState={gameState}
      />

      <GameControls
        difficulty={gameState.difficulty}
        onDifficultyChange={handleDifficultyChange}
        onNewGame={handleNewGameClick}
        gameInProgress={gameState.gameInProgress}
      />

      <StatsBar
        lives={gameState.lives}
        score={gameState.score}
        mistakes={gameState.mistakes}
        difficulty={gameState.difficulty}
      />

      <GameBoard
        board={gameState.board}
        puzzle={gameState.puzzle}
        solution={gameState.solution}
        selectedCell={selectedCell}
        onCellClick={handleCellClick}
        hasLives={gameState.lives > 0}
      />

      <TutorChat
        gameState={gameState}
        selectedCell={selectedCell}
      />

      {/* Hidden input for mobile native keyboard - always render for mobile detection */}
      <input
        id="mobile-number-input"
        ref={mobileInputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="mobile-number-input"
        onChange={handleMobileInput}
        onKeyDown={handleMobileKeyDown}
        onBlur={(e) => {
          // Clear value on blur
          e.target.value = '';
        }}
        aria-label="Enter number"
        style={{ display: isMobile ? 'block' : 'none' }}
      />


      <GameModals
        showWinModal={showWinModal}
        showGameOverModal={showGameOverModal}
        showNewGameModal={showNewGameModal}
        showPurchaseModal={showPurchaseModal}
        showScoreSubmissionSuccessModal={showScoreSubmissionSuccessModal}
        showNameInputModal={showNameInputModal}
        showKeepPlayingModal={showKeepPlayingModal}
        winStats={winStats}
        gameOverStats={gameOverStats}
        pendingScoreData={{ completionId }}
        setShowWinModal={setShowWinModal}
        setShowGameOverModal={setShowGameOverModal}
        setShowNewGameModal={setShowNewGameModal}
        setShowScoreSubmissionSuccessModal={setShowScoreSubmissionSuccessModal}
        setShowNameInputModal={setShowNameInputModal}
        setShowKeepPlayingModal={setShowKeepPlayingModal}
        startNewGame={startNewGame}
        onKeepPlaying={handleKeepPlaying}
        pendingDifficultyChange={pendingDifficultyChange}
        setPendingDifficultyChange={setPendingDifficultyChange}
        handlePurchaseClose={handlePurchaseClose}
        handlePurchaseSuccess={handlePurchaseSuccess}
        closePurchaseModal={closePurchaseModal}
        openScoreSubmissionSuccessModal={openScoreSubmissionSuccessModal}
        openNameInputModal={openNameInputModal}
        closeNameInputModal={closeNameInputModal}
        completionId={completionId}
        qualifiedForLeaderboard={qualifiedForLeaderboard}
      />
    </GamePageLayout>
  );
}

