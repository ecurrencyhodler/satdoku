import { useEffect, useRef, useCallback } from 'react';
import { StateManager } from '../../src/js/system/localState.js';
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
        // Validate board structure before setting state
        if (!result.state.currentBoard || !Array.isArray(result.state.currentBoard)) {
          throw new Error('Invalid board structure received from server');
        }
        
        // Ensure board is a proper 2D array (not sparse)
        const validatedBoard = result.state.currentBoard.map((row) => {
          if (!Array.isArray(row)) {
            return Array(9).fill(0); // Return empty row as fallback
          }
          return row;
        });
        
        const transformedState = {
          board: validatedBoard,
          puzzle: result.state.currentPuzzle,
          difficulty: result.state.difficulty,
          mistakes: result.state.mistakes,
          gameInProgress: result.state.gameInProgress,
          score: result.state.score,
          moves: result.state.moves,
          lives: result.state.lives,
          livesPurchased: result.state.livesPurchased || 0,
          completedRows: result.state.completedRows || [],
          completedColumns: result.state.completedColumns || [],
          completedBoxes: result.state.completedBoxes || [],
          version: result.state.version
        };
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
        // Validate board structure before setting state
        if (!result.state.currentBoard || !Array.isArray(result.state.currentBoard)) {
          throw new Error('Invalid board structure received from server');
        }
        
        // Ensure board is a proper 2D array (not sparse)
        const validatedBoard = result.state.currentBoard.map((row) => {
          if (!Array.isArray(row)) {
            return Array(9).fill(0); // Return empty row as fallback
          }
          return row;
        });
        
        // Transform server state to client format
        const transformedState = {
          board: validatedBoard,
          puzzle: result.state.currentPuzzle,
          difficulty: result.state.difficulty,
          mistakes: result.state.mistakes,
          gameInProgress: result.state.gameInProgress,
          score: result.state.score,
          moves: result.state.moves,
          lives: result.state.lives,
          livesPurchased: result.state.livesPurchased || 0,
          completedRows: result.state.completedRows || [],
          completedColumns: result.state.completedColumns || [],
          completedBoxes: result.state.completedBoxes || [],
          version: result.state.version
        };
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
        // Validate board structure before setting state
        if (!state.currentBoard || !Array.isArray(state.currentBoard)) {
          // Fallback to starting a new game if state is corrupted
          await startNewGame();
          isLoadingStateRef.current = false;
          return false;
        }
        
        // Ensure board is a proper 2D array (not sparse)
        const validatedBoard = state.currentBoard.map((row) => {
          if (!Array.isArray(row)) {
            return Array(9).fill(0); // Return empty row as fallback
          }
          return row;
        });
        
        // Transform server state to client format
        const transformedState = {
          board: validatedBoard,
          puzzle: state.currentPuzzle,
          difficulty: state.difficulty,
          mistakes: state.mistakes,
          gameInProgress: state.gameInProgress,
          score: state.score,
          moves: state.moves,
          lives: state.lives,
          livesPurchased: state.livesPurchased || 0,
          completedRows: state.completedRows || [],
          completedColumns: state.completedColumns || [],
          completedBoxes: state.completedBoxes || [],
          version: state.version
        };
        setGameState(transformedState);
        
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
