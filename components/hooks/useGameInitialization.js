import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BoardGenerator } from '../../src/js/core/boardGenerator.js';
import { Validator } from '../../src/js/core/validator.js';
import { ScoringEngine } from '../../src/js/core/scoringEngine.js';
import { LivesManager } from '../../src/js/system/livesManager.js';
import { StateManager } from '../../src/js/system/localState.js';
import { GameState } from '../../src/js/core/gameState.js';
import { GameController } from '../../src/js/core/gameController.js';
import { UIAnimations } from '../../src/js/ui/uiAnimations.js';

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

  const searchParams = useSearchParams();
  const router = useRouter();

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

  const loadGameState = () => {
    const loaded = gameStateRef.current.loadState(
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
    } else {
      startNewGame();
    }
  };

  const startNewGame = (pendingDifficultyChange = null) => {
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
  };

  const saveGameState = () => {
    gameStateRef.current.saveState(scoringEngineRef.current, livesManagerRef.current);
  };

  // Initialize game on mount and handle payment success
  useEffect(() => {
    const paymentSuccess = searchParams?.get('payment_success');
    
    if (paymentSuccess === 'true') {
      // Life was already added in purchase-success page
      // Reload the game state with updated lives
      loadGameState();
      // Reset purchase modal trigger flag since life was added
      if (gameControllerRef.current) {
        gameControllerRef.current.resetPurchaseModalTrigger();
      }
      // Close purchase modal if it's open
      if (setShowPurchaseModal) {
        setShowPurchaseModal(false);
      }
      // Clean up URL param
      router.replace('/');
    } else if (!hasInitialized.current) {
      // Only load initial state once
      hasInitialized.current = true;
      loadGameState();
    }
  }, [searchParams, router, setShowPurchaseModal]);

  return {
    gameStateRef,
    scoringEngineRef,
    livesManagerRef,
    validatorRef,
    gameControllerRef,
    startNewGame,
    saveGameState,
    updateGameState,
  };
}
