import { useEffect, useRef, useCallback } from 'react';
import { StateManager } from '../../src/js/system/localState.js';
import { transformServerStateToClient } from '../../src/js/system/stateTransformation.js';
import { usePaymentSuccessHandler } from './usePaymentSuccessHandler.js';

/**
 * Hook for managing game initialization and state loading
 * Now uses server-authoritative actions
 */
export function useGameInitialization(setGameState, setSelectedCell, setShowPurchaseModal, chatResetRef) {
  const hasInitialized = useRef(false);
  const isLoadingStateRef = useRef(false); // Prevent moves during state reload

  const startNewGame = useCallback(async (pendingDifficultyChange = null) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:14',message:'startNewGame ENTRY',data:{hasChatResetRef:!!chatResetRef?.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:27',message:'calling DELETE chat-history',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          await fetch('/api/tutor/chat-history', { method: 'DELETE' });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:29',message:'DELETE chat-history completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
        } catch (error) {
          console.warn('[useGameInitialization] Failed to clear chat history:', error);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:32',message:'DELETE chat-history ERROR',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
        }

        // Reset client-side chat state after server-side clear
        if (chatResetRef?.current) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:36',message:'calling chatResetRef.current',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            await chatResetRef.current();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:38',message:'chatResetRef.current completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
          } catch (error) {
            console.warn('[useGameInitialization] Failed to reset chat state:', error);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:41',message:'chatResetRef.current ERROR',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameInitialization.js:45',message:'chatResetRef.current is NULL',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
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
  }, [setGameState, setSelectedCell, chatResetRef]);

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
