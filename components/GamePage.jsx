'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useCellInput } from './hooks/useCellInput';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useModalState } from './hooks/useModalState';
import { useGamePageHandlers } from './hooks/useGamePageHandlers';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useMobileInput } from './hooks/useMobileInput';
import { StateManager } from '../src/js/system/localState.js';
import { transformServerStateToClient } from '../src/js/system/stateTransformation.js';
import GameBoard from './GameBoard';
import StatsBar from './StatsBar';
import GameControls from './GameControls';
import GameModals from './GameModals';
import GamePageHeader from './GamePageHeader';
import GamePageLayout from './GamePageLayout';
import TutorChat from './TutorChat';
import NumberPad from './NumberPad';
import NoteControls from './NoteControls';

export default function GamePage() {
  const [gameState, setGameState] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [pendingDifficultyChange, setPendingDifficultyChange] = useState(null);
  const [noteMode, setNoteMode] = useState(false);

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
    isLoadingState,
    noteMode
  );

  // Toggle note mode handler
  const handleToggleNoteMode = useCallback(() => {
    setNoteMode(prev => !prev);
  }, []);

  // Clear notes handler
  const handleClearNotes = useCallback(async () => {
    if (!gameState) return;

    try {
      const result = await StateManager.sendGameAction(
        { action: 'clearNotes' },
        gameState.version
      );

      if (result.success) {
        const transformedState = transformServerStateToClient(result.state);
        setGameState(transformedState);
      } else if (result.conflict) {
        console.warn('[GamePage] Version conflict, reloading state');
        const currentState = await StateManager.loadGameState();
        if (currentState) {
          setGameState(currentState);
        }
      } else {
        console.error('[GamePage] Clear notes failed:', result.error);
      }
    } catch (error) {
      console.error('[GamePage] Error clearing notes:', error);
    }
  }, [gameState]);

  // Keyboard input hook
  useKeyboardInput(
    gameState,
    selectedCell,
    setSelectedCell,
    null, // gameStateRef no longer needed
    handleCellInput,
    noteMode,
    handleToggleNoteMode
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
          !e.target.closest('.number-pad-vertical') &&
          !e.target.closest('.note-controls') &&
          e.target.id !== 'new-game-btn' &&
          e.target.id !== 'difficulty' &&
          e.target.id !== 'mobile-number-input') {
        setSelectedCell(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [setSelectedCell]);

  // Check if selected cell is locked (prefilled or correctly filled)
  const isSelectedCellLocked = useMemo(() => {
    if (!selectedCell || !gameState) return false;
    const row = selectedCell.row;
    const col = selectedCell.col;
    const currentValue = gameState.board?.[row]?.[col] ?? 0;
    const isPrefilled = gameState.puzzle?.[row]?.[col] !== 0;
    const isIncorrect = !isPrefilled && currentValue !== 0 && gameState.solution && gameState.solution[row]?.[col] !== 0 && currentValue !== gameState.solution[row]?.[col];
    return isPrefilled || (currentValue !== 0 && !isIncorrect);
  }, [selectedCell, gameState]);

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

      <div className="game-board-with-numberpad">
        <GameBoard
          board={gameState.board}
          puzzle={gameState.puzzle}
          solution={gameState.solution}
          selectedCell={selectedCell}
          onCellClick={handleCellClick}
          hasLives={gameState.lives > 0}
          notes={gameState.notes || []}
          noteMode={noteMode}
        />
        <NumberPad
          onNumberClick={handleCellInput}
          disabled={!selectedCell || !gameState.gameInProgress || isSelectedCellLocked}
        />
      </div>

      <div className="note-controls-wrapper">
        <NoteControls
          noteMode={noteMode}
          onToggleNoteMode={handleToggleNoteMode}
          onClear={handleClearNotes}
          disabled={!gameState.gameInProgress}
        />
      </div>

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

