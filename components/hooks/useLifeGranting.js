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

  const grantLife = useCallback(async (checkoutId) => {
    try {
      setIsGranting(true);
      setError(null);
      
      // Purchase verified - add life to game state
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
        
        // Delete the purchase token after successful life grant
        try {
          await fetch('/api/purchase/verify', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutId }),
          });
        } catch (deleteError) {
          // Log error but don't fail the operation - token will expire anyway
          console.warn('Failed to delete purchase token:', deleteError);
        }
        
        setLifeAdded(true);
        setIsGranting(false);
        return { success: true, lifeAdded: true };
      } else {
        // No saved game, but still successful
        // Still delete token to prevent reuse
        try {
          await fetch('/api/purchase/verify', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutId }),
          });
        } catch (deleteError) {
          console.warn('Failed to delete purchase token:', deleteError);
        }
        
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
