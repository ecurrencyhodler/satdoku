import { useState, useCallback, useRef } from 'react';
import { StateManager } from '../../src/js/system/localState.js';
import { LivesManager } from '../../src/js/system/livesManager.js';
import { INITIAL_LIVES } from '../../src/js/system/constants.js';

/**
 * Hook for granting life after purchase verification
 */
export function useLifeGranting() {
  const [isGranting, setIsGranting] = useState(false);
  const [lifeAdded, setLifeAdded] = useState(false);
  const [error, setError] = useState(null);
  const isProcessingRef = useRef(false); // Guard to prevent concurrent executions

  const grantLife = useCallback(async () => {
    console.log('[grantLife] Called', {
      isProcessingRef: isProcessingRef.current,
      timestamp: new Date().toISOString()
    });
    
    // Prevent concurrent executions
    if (isProcessingRef.current) {
      console.log('[grantLife] Already processing, skipping duplicate call');
      return { success: false, lifeAdded: false, error: 'Already processing' };
    }

    try {
      isProcessingRef.current = true;
      setIsGranting(true);
      setError(null);
      
      // Load current state to get current lives
      const saved = await StateManager.loadGameState();
      console.log('[grantLife] Loaded game state:', {
        lives: saved?.lives,
        livesPurchased: saved?.livesPurchased
      });
      
      if (saved) {
        const livesManager = new LivesManager();
        const beforeLives = saved.lives ?? INITIAL_LIVES;
        const beforePurchased = saved.livesPurchased ?? 0;
        
        livesManager.lives = beforeLives;
        livesManager.livesPurchased = beforePurchased;
        
        console.log('[grantLife] Before addLife:', {
          lives: livesManager.getLives(),
          livesPurchased: livesManager.getLivesPurchased()
        });
        
        // Add the purchased life
        livesManager.addLife();
        
        console.log('[grantLife] After addLife:', {
          lives: livesManager.getLives(),
          livesPurchased: livesManager.getLivesPurchased()
        });
        
        // Use mergeGameState to prevent race conditions - only update lives fields
        // This ensures we don't overwrite concurrent game moves
        const partialUpdate = {
          lives: livesManager.getLives(),
          livesPurchased: livesManager.getLivesPurchased()
        };
        
        let retryCount = 0;
        const maxRetries = 3;
        let mergeResult;
        const initialPurchased = beforePurchased; // Track initial value to detect if already added
        
        // Retry on version conflicts
        while (retryCount < maxRetries) {
          mergeResult = await StateManager.mergeGameState(partialUpdate);
          
          if (mergeResult.success || !mergeResult.conflict) {
            break;
          }
          
          // Version conflict - reload and check if life was already added
          console.log(`[grantLife] Version conflict, retry ${retryCount + 1}/${maxRetries}`);
          const updatedState = await StateManager.loadGameState();
          if (updatedState) {
            const updatedPurchased = updatedState.livesPurchased ?? 0;
            
            // Check if life was already added by another concurrent purchase
            if (updatedPurchased > initialPurchased) {
              console.log('[grantLife] Life was already added by concurrent purchase, skipping');
              // Life was already added, return success without adding again
              setLifeAdded(true);
              setIsGranting(false);
              isProcessingRef.current = false;
              return { success: true, lifeAdded: true };
            }
            
            // Recalculate with updated state
            const updatedLivesManager = new LivesManager();
            updatedLivesManager.lives = updatedState.lives ?? INITIAL_LIVES;
            updatedLivesManager.livesPurchased = updatedPurchased;
            updatedLivesManager.addLife();
            partialUpdate.lives = updatedLivesManager.getLives();
            partialUpdate.livesPurchased = updatedLivesManager.getLivesPurchased();
          }
          retryCount++;
        }
        
        if (!mergeResult.success) {
          throw new Error(mergeResult.conflict 
            ? 'Failed to update game state due to concurrent modifications. Please try again.'
            : 'Failed to save game state');
        }
        
        console.log('[grantLife] Saved game state:', {
          lives: partialUpdate.lives,
          livesPurchased: partialUpdate.livesPurchased,
          version: mergeResult.version
        });
        
        setLifeAdded(true);
        setIsGranting(false);
        isProcessingRef.current = false;
        return { success: true, lifeAdded: true };
      } else {
        // No saved game state, but still successful
        console.log('[grantLife] No saved game state found');
        setIsGranting(false);
        isProcessingRef.current = false;
        return { success: true, lifeAdded: false };
      }
    } catch (err) {
      console.error('[grantLife] Failed to grant life:', err);
      setError(err.message);
      setIsGranting(false);
      isProcessingRef.current = false;
      return { success: false, lifeAdded: false };
    }
  }, []);

  return {
    grantLife,
    isGranting,
    lifeAdded,
    error,
  };
}
