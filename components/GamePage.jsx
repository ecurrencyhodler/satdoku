'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useCellInput } from './hooks/useCellInput';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useModalState } from './hooks/useModalState';
import { useGamePageHandlers } from './hooks/useGamePageHandlers';
import GameBoard from './GameBoard';
import StatsBar from './StatsBar';
import GameControls from './GameControls';
import WinModal from './Modals/WinModal';
import GameOverModal from './Modals/GameOverModal';
import NewGameModal from './Modals/NewGameModal';
import PurchaseLifeModal from './PurchaseLifeModal';

export default function GamePage() {
  const [gameState, setGameState] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [pendingDifficultyChange, setPendingDifficultyChange] = useState(null);

  // Modal state hook - must come first so setShowPurchaseModal is available
  const {
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
  } = useModalState();

  // Game initialization hook
  const {
    gameStateRef,
    scoringEngineRef,
    livesManagerRef,
    validatorRef,
    gameControllerRef,
    startNewGame: startNewGameFromHook,
    saveGameState,
    updateGameState,
  } = useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal);

  // Wrapper for startNewGame that handles pending difficulty change
  const startNewGame = () => {
    startNewGameFromHook(pendingDifficultyChange);
    setPendingDifficultyChange(null);
  };

  // Stable callbacks for game events
  const handleWin = useCallback((stats) => {
    openWinModal(stats);
    updateGameState();
  }, [openWinModal, updateGameState]);

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

  // Cell input hook
  const { handleCellInput } = useCellInput(
    selectedCell,
    gameStateRef,
    gameControllerRef,
    updateGameState,
    saveGameState,
    handleWin,
    handleGameOver,
    handlePurchaseLife
  );

  // Keyboard input hook
  useKeyboardInput(
    gameState,
    selectedCell,
    setSelectedCell,
    gameStateRef,
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
    startNewGame
  );

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#game-board') && 
          !e.target.closest('.modal') &&
          e.target.id !== 'new-game-btn' &&
          e.target.id !== 'difficulty') {
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
    <div className="container">
      <header>
        <h1>SatDoku</h1>
      </header>

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
        completedBoxes={gameState.completedBoxes}
        onCellClick={handleCellClick}
        hasLives={gameState.lives > 0}
      />

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
    </div>
  );
}

