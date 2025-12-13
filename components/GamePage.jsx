'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useCellInput } from './hooks/useCellInput';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useModalState } from './hooks/useModalState';
import { useGamePageHandlers } from './hooks/useGamePageHandlers';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useMobileInput } from './hooks/useMobileInput';
import { useGameCompletion } from './hooks/useGameCompletion';
import GameBoard from './GameBoard';
import StatsBar from './StatsBar';
import GameControls from './GameControls';
import GameModals from './GameModals';
import GamePageHeader from './GamePageHeader';
import GamePageLayout from './GamePageLayout';

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

  // Game initialization hook
  const {
    gameStateRef,
    scoringEngineRef,
    livesManagerRef,
    validatorRef,
    gameControllerRef,
    startNewGame: startNewGameFromHook,
    resetBoardKeepStats,
    saveGameState,
    updateGameState,
    isLoadingState,
  } = useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal);

  // Wrapper for startNewGame that handles pending difficulty change
  const startNewGame = () => {
    startNewGameFromHook(pendingDifficultyChange);
    setPendingDifficultyChange(null);
  };

  // Game completion hook
  const { saveCompletion } = useGameCompletion(gameStateRef, gameState);

  // Stable callbacks for game events
  const handleWin = useCallback(async (stats) => {
    openWinModal(stats);
    updateGameState();
    // Save completion to API with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let saved = false;
    
    while (retryCount < maxRetries && !saved) {
      try {
        await saveCompletion(stats);
        saved = true;
      } catch (error) {
        retryCount++;
        console.error(`[GamePage] Failed to save completion (attempt ${retryCount}/${maxRetries}):`, error);
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          console.error('[GamePage] Failed to save completion after all retries - completion data may be lost');
        }
      }
    }
  }, [openWinModal, updateGameState, saveCompletion]);

  const handleGameOver = useCallback(() => {
    const stats = gameControllerRef.current?.getGameStats();
    if (stats) {
      openGameOverModal(stats);
    }
  }, [openGameOverModal, gameControllerRef]);

  const handlePurchaseLife = useCallback(() => {
    console.log('Opening purchase modal');
    openPurchaseModal();
  }, [openPurchaseModal]);

  const handleKeepPlaying = useCallback(() => {
    // Close the modal
    setShowWinModal(false);
    // Reset the board while preserving stats
    resetBoardKeepStats();
  }, [setShowWinModal, resetBoardKeepStats]);

  // Cell input hook
  const { handleCellInput } = useCellInput(
    selectedCell,
    gameStateRef,
    gameControllerRef,
    updateGameState,
    saveGameState,
    handleWin,
    handleGameOver,
    handlePurchaseLife,
    isLoadingState
  );

  // Keyboard input hook
  useKeyboardInput(
    gameState,
    selectedCell,
    setSelectedCell,
    gameStateRef,
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
    handlePurchaseSuccess,
    handlePurchaseClose,
  } = useGamePageHandlers(
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
  );

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#game-board') && 
          !e.target.closest('.modal') &&
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
        gameControllerRef={gameControllerRef}
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
        selectedCell={selectedCell}
        completedRows={gameState.completedRows}
        completedColumns={gameState.completedColumns}
        completedBoxes={gameState.completedBoxes}
        onCellClick={handleCellClick}
        hasLives={gameState.lives > 0}
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

      <div className="github-link-container">
        <a 
          href="https://github.com/ecurrencyhodler" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
          aria-label="GitHub"
        >
          <svg 
            height="32" 
            aria-hidden="true" 
            viewBox="0 0 16 16" 
            version="1.1" 
            width="32" 
            fill="currentColor"
          >
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
          </svg>
        </a>
      </div>

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
        pendingScoreData={pendingScoreData}
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
      />
    </GamePageLayout>
  );
}

