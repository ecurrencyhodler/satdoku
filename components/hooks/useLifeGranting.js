import { useState, useCallback } from 'react';
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

  const grantLife = useCallback(async () => {
    try {
      setIsGranting(true);
      setError(null);
      
      // Add life to game state
      const saved = StateManager.loadGameState();
      if (saved) {
        const livesManager = new LivesManager();
        livesManager.lives = saved.lives || INITIAL_LIVES;
        livesManager.livesPurchased = saved.livesPurchased || 0;
        
        // Add the purchased life
        livesManager.addLife();
        
        // Update saved state
        saved.lives = livesManager.getLives();
        saved.livesPurchased = livesManager.getLivesPurchased();
        StateManager.saveGameState(saved);
        
        setLifeAdded(true);
        setIsGranting(false);
        return { success: true, lifeAdded: true };
      } else {
        // No saved game state, but still successful
        setIsGranting(false);
        return { success: true, lifeAdded: false };
      }
    } catch (err) {
      console.error('Failed to grant life:', err);
      setError(err.message);
      setIsGranting(false);
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
