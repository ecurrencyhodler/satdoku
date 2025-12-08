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
      
      // Add life to game state
      const saved = StateManager.loadGameState();
      console.log('[grantLife] Loaded game state:', {
        lives: saved?.lives,
        livesPurchased: saved?.livesPurchased
      });
      
      if (saved) {
        const livesManager = new LivesManager();
        const beforeLives = saved.lives || INITIAL_LIVES;
        const beforePurchased = saved.livesPurchased || 0;
        
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
        
        // Update saved state
        saved.lives = livesManager.getLives();
        saved.livesPurchased = livesManager.getLivesPurchased();
        StateManager.saveGameState(saved);
        
        console.log('[grantLife] Saved game state:', {
          lives: saved.lives,
          livesPurchased: saved.livesPurchased
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
