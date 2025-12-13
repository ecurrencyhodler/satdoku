import { useCallback, useRef } from 'react';
import { StateManager } from '../../src/js/system/localState.js';

/**
 * Hook for handling game state saving with conflict resolution
 */
export function useGameStateSaving(
  gameStateRef,
  scoringEngineRef,
  livesManagerRef,
  isLoadingStateRef,
  updateGameState
) {
  const saveGameState = useCallback(async () => {
    // Don't save if we're currently loading state (prevents overwriting with stale version)
    if (isLoadingStateRef.current) {
      console.warn('[useGameStateSaving] Skipping save - state is currently loading');
      return { success: false, skipped: true };
    }
    
    // Try to save with current version first - optimistic locking will catch conflicts
    // This is more efficient than always reloading before save
    let result = await gameStateRef.current.saveState(scoringEngineRef.current, livesManagerRef.current);
    
    // If there's a version conflict, it means a concurrent update happened (e.g., purchase)
    // Reload state to get the latest version and sync lives, then retry
    if (result.conflict) {
      console.log('[useGameStateSaving] Version conflict detected, reloading and syncing lives');
      try {
        // Reload state to get latest version and lives from storage
        const updatedState = await StateManager.loadGameState();
        if (updatedState) {
          // Log conflict details for debugging
          const currentMoves = scoringEngineRef.current.getMoves();
          const storedMoves = updatedState.moves ?? 0;
          const currentScore = scoringEngineRef.current.getScore();
          const storedScore = updatedState.score ?? 0;
          
          console.log('[useGameStateSaving] Conflict details:', {
            currentVersion: gameStateRef.current.currentVersion,
            storedVersion: updatedState.version,
            currentMoves,
            storedMoves,
            currentScore,
            storedScore,
            currentLives: livesManagerRef.current.getLives(),
            storedLives: updatedState.lives
          });
          
          // Warn if stored state appears to have more progress (though we still prioritize in-memory state)
          if (storedMoves > currentMoves || storedScore > currentScore) {
            console.warn('[useGameStateSaving] Stored state has more progress, but preserving in-memory state for user experience');
          }
          
          // Update version for the retry
          if (updatedState.version !== undefined) {
            gameStateRef.current.currentVersion = updatedState.version;
          } else {
            console.warn('[useGameStateSaving] Stored state missing version, setting to null');
            gameStateRef.current.currentVersion = null;
          }
          
          // Sync lives from storage to prevent overwriting purchased lives
          // This is critical: if a purchase happened, we need to use the updated lives
          // We only sync lives-related fields to avoid overwriting the user's current moves
          const livesChanged = updatedState.lives !== undefined && 
            updatedState.lives !== livesManagerRef.current.getLives();
          const purchasedChanged = updatedState.livesPurchased !== undefined && 
            updatedState.livesPurchased !== livesManagerRef.current.getLivesPurchased();
          
          if (livesChanged || purchasedChanged) {
            if (updatedState.lives !== undefined) {
              livesManagerRef.current.lives = updatedState.lives;
            }
            if (updatedState.livesPurchased !== undefined) {
              livesManagerRef.current.livesPurchased = updatedState.livesPurchased;
            }
            console.log('[useGameStateSaving] Synced lives from storage:', {
              lives: livesManagerRef.current.getLives(),
              livesPurchased: livesManagerRef.current.getLivesPurchased()
            });
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
            console.warn('[useGameStateSaving] Version conflict persists after retry - concurrent update may be in progress');
          } else {
            console.log('[useGameStateSaving] Successfully resolved conflict and saved state');
          }
        } else {
          console.warn('[useGameStateSaving] No state found when reloading after conflict - state may have been deleted');
          // If state was deleted, reset version to null for next save
          gameStateRef.current.currentVersion = null;
        }
      } catch (retryError) {
        console.error('[useGameStateSaving] Failed to retry save after conflict:', retryError);
        // Reset version on error to allow next save to proceed
        gameStateRef.current.currentVersion = null;
      }
    }
    
    return result;
  }, [gameStateRef, scoringEngineRef, livesManagerRef, isLoadingStateRef, updateGameState]);

  return { saveGameState };
}


