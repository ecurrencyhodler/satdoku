import { useEffect, useRef, useCallback } from 'react';
import { BoardGenerator } from '../../src/js/core/boardGenerator.js';
import { Validator } from '../../src/js/core/validator.js';
import { ScoringEngine } from '../../src/js/core/scoringEngine.js';
import { LivesManager } from '../../src/js/system/livesManager.js';
import { StateManager } from '../../src/js/system/localState.js';
import { GameState } from '../../src/js/core/gameState.js';
import { GameController } from '../../src/js/core/gameController.js';
import { useGameStateSaving } from './useGameStateSaving.js';
import { usePaymentSuccessHandler } from './usePaymentSuccessHandler.js';

/**
 * Hook for managing game initialization, state loading, and new game creation
 */
export function useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal) {
  const boardGeneratorRef = useRef(new BoardGenerator());
  const scoringEngineRef = useRef(new ScoringEngine());
  const livesManagerRef = useRef(new LivesManager());
  const gameStateRef = useRef(new GameState());
  const validatorRef = useRef(null);
  const gameControllerRef = useRef(null);
  const hasInitialized = useRef(false);
  const isLoadingStateRef = useRef(false); // Prevent moves during state reload

  // Internal function to update React state from refs
  const updateGameState = () => {
    setGameState({
      board: gameStateRef.current.currentBoard.map(row => [...row]),
      puzzle: gameStateRef.current.currentPuzzle.map(row => [...row]),
      difficulty: gameStateRef.current.currentDifficulty,
      mistakes: gameStateRef.current.mistakes,
      gameInProgress: gameStateRef.current.gameInProgress,
      score: scoringEngineRef.current.getScore(),
      moves: scoringEngineRef.current.getMoves(),
      lives: livesManagerRef.current.getLives(),
      completedRows: Array.from(scoringEngineRef.current.completedRows),
      completedColumns: Array.from(scoringEngineRef.current.completedColumns),
      completedBoxes: Array.from(scoringEngineRef.current.completedBoxes),
    });
  };

  const startNewGame = useCallback((pendingDifficultyChange = null) => {
    if (pendingDifficultyChange) {
      gameStateRef.current.currentDifficulty = pendingDifficultyChange;
    }

    const difficulty = gameStateRef.current.getDifficultyConfig();
    const { puzzle, solution } = boardGeneratorRef.current.generatePuzzle(difficulty);

    gameStateRef.current.initializeNewGame(puzzle, solution, gameStateRef.current.currentDifficulty);
    validatorRef.current = new Validator(solution);
    gameControllerRef.current = new GameController(
      gameStateRef.current,
      validatorRef.current,
      scoringEngineRef.current,
      livesManagerRef.current
    );

    scoringEngineRef.current.reset();
    livesManagerRef.current.reset();
    setSelectedCell(null);
    // Note: Completion styling is cleared automatically by React when state updates

    // Reset purchase modal trigger flag when starting new game
    if (gameControllerRef.current) {
      gameControllerRef.current.resetPurchaseModalTrigger();
    }

    StateManager.clearGameState();
    updateGameState();
  }, [setSelectedCell]);

  const loadGameState = useCallback(async () => {
    try {
      isLoadingStateRef.current = true;
      const loaded = await gameStateRef.current.loadState(
        scoringEngineRef.current,
        livesManagerRef.current
      );

      if (loaded) {
        validatorRef.current = new Validator(gameStateRef.current.currentSolution);
        gameControllerRef.current = new GameController(
          gameStateRef.current,
          validatorRef.current,
          scoringEngineRef.current,
          livesManagerRef.current
        );
        updateGameState();
        
        // Check if lives are 0 after loading state and trigger purchase modal if needed
        if (!livesManagerRef.current.hasLives() && gameControllerRef.current && !gameControllerRef.current.purchaseModalTriggered) {
          gameControllerRef.current.purchaseModalTriggered = true;
          setShowPurchaseModal(true);
        }
        
        isLoadingStateRef.current = false;
        return true;
      } else {
        startNewGame();
        isLoadingStateRef.current = false;
        return false;
      }
    } catch (error) {
      console.error('[useGameInitialization] Failed to load game state:', error);
      // Fallback to new game on error
      startNewGame();
      isLoadingStateRef.current = false;
      return false;
    }
  }, [startNewGame]);

  // Use game state saving hook for conflict resolution
  const { saveGameState } = useGameStateSaving(
    gameStateRef,
    scoringEngineRef,
    livesManagerRef,
    isLoadingStateRef,
    updateGameState
  );

  // Handle payment success (separate hook)
  usePaymentSuccessHandler(
    gameStateRef,
    gameControllerRef,
    isLoadingStateRef,
    setShowPurchaseModal,
    loadGameState,
    saveGameState,
    updateGameState
  );

  // Initialize game on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      // Only load initial state once
      hasInitialized.current = true;
      loadGameState().catch((error) => {
        console.error('[useGameInitialization] Error loading initial game state:', error);
      });
    }
  }, [loadGameState]);

  return {
    gameStateRef,
    scoringEngineRef,
    livesManagerRef,
    validatorRef,
    gameControllerRef,
    startNewGame,
    saveGameState,
    updateGameState,
    isLoadingState: isLoadingStateRef,
  };
}
