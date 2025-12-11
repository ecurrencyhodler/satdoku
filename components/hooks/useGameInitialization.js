import { useEffect, useRef, useCallback } from 'react';
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
  const isLoadingStateRef = useRef(false); // Prevent moves during state reload

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

  const saveGameState = useCallback(async () => {
    // Don't save if we're currently loading state (prevents overwriting with stale version)
    if (isLoadingStateRef.current) {
      console.warn('[useGameInitialization] Skipping save - state is currently loading');
      return { success: false, skipped: true };
    }
    
    // Try to save with current version first - optimistic locking will catch conflicts
    // This is more efficient than always reloading before save
    let result = await gameStateRef.current.saveState(scoringEngineRef.current, livesManagerRef.current);
    
    // If there's a version conflict, it means a concurrent update happened (e.g., purchase)
    // Reload state to get the latest version and sync lives, then retry
    if (result.conflict) {
      console.log('[useGameInitialization] Version conflict detected, reloading and syncing lives');
      try {
        // Reload state to get latest version and lives from storage
        const updatedState = await StateManager.loadGameState();
        if (updatedState) {
          // Update version for the retry
          if (updatedState.version !== undefined) {
            gameStateRef.current.currentVersion = updatedState.version;
          }
          
          // Sync lives from storage to prevent overwriting purchased lives
          // This is critical: if a purchase happened, we need to use the updated lives
          // We only sync lives-related fields to avoid overwriting the user's current moves
          if (updatedState.lives !== undefined) {
            livesManagerRef.current.lives = updatedState.lives;
          }
          if (updatedState.livesPurchased !== undefined) {
            livesManagerRef.current.livesPurchased = updatedState.livesPurchased;
          }
          
          // Update UI to reflect the synced lives immediately
          updateGameState();
          
          // Note: We intentionally do NOT sync score, moves, or completed sets here
          // because those should reflect the user's current game state in memory.
          // However, if the stored state has a newer version, it means another operation
          // (like a purchase) happened, and we prioritize preserving the user's current moves.
          
          // Retry save with updated version and lives
          result = await gameStateRef.current.saveState(scoringEngineRef.current, livesManagerRef.current);
          
          // If we still have a conflict after retry, log it but don't retry again
          // (to avoid infinite loops from rapid concurrent updates)
          if (result.conflict) {
            console.warn('[useGameInitialization] Version conflict persists after retry - concurrent update may be in progress');
          }
        } else {
          console.warn('[useGameInitialization] No state found when reloading after conflict');
        }
      } catch (retryError) {
        console.error('[useGameInitialization] Failed to retry save after conflict:', retryError);
      }
    }
    
    return result;
  }, []);

  // Initialize game on mount and handle payment success
  useEffect(() => {
    const paymentSuccess = searchParams?.get('payment_success');
    
    if (paymentSuccess === 'true') {
      // Life was already added in purchase-success page
      // IMPORTANT: Save any unsaved moves before reloading to prevent data loss
      const handlePaymentSuccess = async () => {
        try {
          // Save current state first to preserve any unsaved moves
          // This prevents losing moves made between purchase completion and redirect
          let stateLoaded = false;
          if (gameStateRef.current.gameInProgress) {
            console.log('[useGameInitialization] Saving state before reloading after purchase');
            const saveResult = await saveGameState();
            
            // If save succeeded, state is already synced (including lives synced during conflict resolution if any)
            // Only reload if save failed to ensure we at least get the purchased life
            if (!saveResult.success) {
              console.log('[useGameInitialization] Save failed, reloading to get purchased life and latest state');
              stateLoaded = await loadGameState();
            } else {
              // Save succeeded - state is already up to date, just ensure UI reflects current state
              // (conflict handler already called updateGameState() if there was a conflict)
              console.log('[useGameInitialization] Save succeeded, state is already synced');
              updateGameState();
              stateLoaded = true; // State is loaded in memory, just didn't reload from storage
            }
          } else {
            // No game in progress, just reload to get the purchased life
            stateLoaded = await loadGameState();
          }
          
          if (stateLoaded) {
            // Reset purchase modal trigger flag since life was added
            if (gameControllerRef.current) {
              gameControllerRef.current.resetPurchaseModalTrigger();
            }
            // Close purchase modal if it's open
            if (setShowPurchaseModal) {
              setShowPurchaseModal(false);
            }
          }
        } catch (error) {
          console.error('[useGameInitialization] Error handling payment success:', error);
          // Even on error, try to reload state to get the purchased life
          try {
            await loadGameState();
          } catch (reloadError) {
            console.error('[useGameInitialization] Failed to reload state after error:', reloadError);
          }
        } finally {
          // Clean up URL param after state is loaded
          router.replace('/');
        }
      };
      
      handlePaymentSuccess();
    } else if (!hasInitialized.current) {
      // Only load initial state once
      hasInitialized.current = true;
      loadGameState().catch((error) => {
        console.error('[useGameInitialization] Error loading initial game state:', error);
      });
    }
  }, [searchParams, router, setShowPurchaseModal, loadGameState, saveGameState]);

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
