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
      
      // Validate checkoutId format
      if (!checkoutId || typeof checkoutId !== 'string' || checkoutId.trim().length === 0) {
        throw new Error('Invalid checkout ID');
      }
      
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
        // Retry up to 3 times to ensure token is deleted
        let deleteSuccess = false;
        for (let attempt = 0; attempt < 3 && !deleteSuccess; attempt++) {
          try {
            const deleteResponse = await fetch('/api/purchase/verify', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkoutId }),
            });
            
            if (deleteResponse.ok) {
              deleteSuccess = true;
            } else if (attempt < 2) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          } catch (deleteError) {
            if (attempt === 2) {
              // Log error on final attempt but don't fail the operation - token will expire anyway
              console.warn('Failed to delete purchase token after retries:', deleteError);
            }
          }
        }
        
        setLifeAdded(true);
        setIsGranting(false);
        return { success: true, lifeAdded: true };
      } else {
        // No saved game, but still successful
        // Still delete token to prevent reuse
        let deleteSuccess = false;
        for (let attempt = 0; attempt < 3 && !deleteSuccess; attempt++) {
          try {
            const deleteResponse = await fetch('/api/purchase/verify', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkoutId }),
            });
            
            if (deleteResponse.ok) {
              deleteSuccess = true;
            } else if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          } catch (deleteError) {
            if (attempt === 2) {
              console.warn('Failed to delete purchase token after retries:', deleteError);
            }
          }
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
