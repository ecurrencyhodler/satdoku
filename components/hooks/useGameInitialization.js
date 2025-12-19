import { useEffect, useRef, useCallback } from 'react';
import { StateManager } from '../../src/js/system/localState.js';
import { transformServerStateToClient } from '../../src/js/system/stateTransformation.js';
import { usePaymentSuccessHandler } from './usePaymentSuccessHandler.js';

/**
 * Hook for managing game initialization and state loading
 * Now uses server-authoritative actions
 */
export function useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal) {
  const hasInitialized = useRef(false);
  const isLoadingStateRef = useRef(false); // Prevent moves during state reload

  const startNewGame = useCallback(async (pendingDifficultyChange = null) => {
    try {
      isLoadingStateRef.current = true;
      const difficulty = pendingDifficultyChange || 'beginner';

      const result = await StateManager.sendGameAction({
        action: 'startNewGame',
        difficulty
      });

      if (result.success) {
        // Clear chat history when starting new game
        try {
          await fetch('/api/tutor/chat-history', { method: 'DELETE' });
        } catch (error) {
          console.warn('[useGameInitialization] Failed to clear chat history:', error);
        }

        // Transform server state to client format
        const transformedState = transformServerStateToClient(result.state);
        setGameState(transformedState);
        setSelectedCell(null);
      } else {
        console.error('[useGameInitialization] Failed to start new game:', result.error);
      }
    } catch (error) {
      console.error('[useGameInitialization] Error starting new game:', error);
    } finally {
      isLoadingStateRef.current = false;
    }
  }, [setGameState, setSelectedCell]);

  // Reset board while preserving stats (for "Keep playing" feature)
  const resetBoardKeepStats = useCallback(async () => {
    try {
      isLoadingStateRef.current = true;

      const result = await StateManager.sendGameAction({
        action: 'keepPlaying'
      });

      if (result.success) {
        // Transform server state to client format
        const transformedState = transformServerStateToClient(result.state);
        setGameState(transformedState);
        setSelectedCell(null);
      } else {
        console.error('[useGameInitialization] Failed to keep playing:', result.error);
      }
    } catch (error) {
      console.error('[useGameInitialization] Error keeping playing:', error);
    } finally {
      isLoadingStateRef.current = false;
    }
  }, [setGameState, setSelectedCell]);

  const loadGameState = useCallback(async () => {
    try {
      isLoadingStateRef.current = true;
      const state = await StateManager.loadGameState();

      if (state) {
        try {
          // Transform server state to client format
          const transformedState = transformServerStateToClient(state);
          setGameState(transformedState);
        } catch (error) {
          // Fallback to starting a new game if state is corrupted
          console.warn('[useGameInitialization] Invalid state structure, starting new game:', error);
          await startNewGame();
          isLoadingStateRef.current = false;
          return false;
        }

        // Check if lives are 0 and trigger purchase modal if needed
        if (state.lives === 0 && state.gameInProgress) {
          setShowPurchaseModal(true);
        }

        isLoadingStateRef.current = false;
        return true;
      } else {
        // No state exists, start new game
        await startNewGame();
        isLoadingStateRef.current = false;
        return false;
      }
    } catch (error) {
      console.error('[useGameInitialization] Failed to load game state:', error);
      // Fallback to new game on error
      await startNewGame();
      isLoadingStateRef.current = false;
      return false;
    }
  }, [setGameState, setShowPurchaseModal, startNewGame]);

  // Handle payment success (separate hook)
  // Note: This hook may need updates to work with server-authoritative actions
  usePaymentSuccessHandler(
    null, // gameStateRef - no longer needed
    null, // gameControllerRef - no longer needed
    isLoadingStateRef,
    setShowPurchaseModal,
    loadGameState,
    null, // saveGameState - no longer needed
    null  // updateGameState - no longer needed
  );

  // Initialize game on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      // Only load initial state once
      hasInitialized.current = true;

      // Clean up old localStorage sessionID (migration cleanup)
      StateManager.cleanupOldSessionStorage();

      loadGameState().catch((error) => {
        console.error('[useGameInitialization] Error loading initial game state:', error);
      });
    }
  }, [loadGameState]);

  return {
    startNewGame,
    resetBoardKeepStats,
    isLoadingState: isLoadingStateRef,
  };
}
