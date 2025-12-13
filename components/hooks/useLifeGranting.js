import { useState, useCallback, useRef } from 'react';
import { StateManager } from '../../src/js/system/localState.js';

/**
 * Hook for granting life after purchase verification
 * Now uses server-authoritative actions
 */
export function useLifeGranting() {
  const [isGranting, setIsGranting] = useState(false);
  const [lifeAdded, setLifeAdded] = useState(false);
  const [error, setError] = useState(null);
  const isProcessingRef = useRef(false); // Guard to prevent concurrent executions

  const grantLife = useCallback(async (checkoutId = null) => {
    console.log('[grantLife] Called', {
      isProcessingRef: isProcessingRef.current,
      checkoutId,
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
      
      // Load current state to get version for optimistic locking
      const saved = await StateManager.loadGameState();
      
      if (!saved) {
        console.log('[grantLife] No saved game state found');
        setIsGranting(false);
        isProcessingRef.current = false;
        return { success: false, lifeAdded: false, error: 'No game state found' };
      }

      const expectedVersion = saved.version ?? null;
      const initialLivesPurchased = saved.livesPurchased ?? 0;
      
      console.log('[grantLife] Current state:', {
        lives: saved.lives,
        livesPurchased: initialLivesPurchased,
        version: expectedVersion
      });
      
      // Use server-authoritative action to purchase life
      let retryCount = 0;
      const maxRetries = 3;
      let result;
      
      // Retry on version conflicts
      while (retryCount < maxRetries) {
        const currentVersion = retryCount === 0 
          ? expectedVersion 
          : (await StateManager.loadGameState())?.version ?? null;
        
        result = await StateManager.sendGameAction(
          { 
            action: 'purchaseLife',
            checkoutId 
          },
          currentVersion
        );
        
        if (result.success || !result.conflict) {
          break;
        }
        
        // Version conflict - reload state and check if life was already added
        console.log(`[grantLife] Version conflict, retry ${retryCount + 1}/${maxRetries}`);
        const updatedState = await StateManager.loadGameState();
        
        if (updatedState) {
          const updatedPurchased = updatedState.livesPurchased ?? 0;
          
          // Check if life was already added by another concurrent purchase
          if (updatedPurchased > initialLivesPurchased) {
            console.log('[grantLife] Life was already added by concurrent purchase');
            setLifeAdded(true);
            setIsGranting(false);
            isProcessingRef.current = false;
            return { success: true, lifeAdded: true };
          }
        }
        
        retryCount++;
      }
      
      if (!result.success) {
        const errorMessage = result.error || 'Failed to purchase life';
        throw new Error(errorMessage);
      }
      
      console.log('[grantLife] Life purchased successfully:', {
        lives: result.state?.lives,
        livesPurchased: result.state?.livesPurchased,
        version: result.version
      });
      
      setLifeAdded(true);
      setIsGranting(false);
      isProcessingRef.current = false;
      return { success: true, lifeAdded: true };
    } catch (err) {
      console.error('[grantLife] Failed to grant life:', err);
      setError(err.message);
      setIsGranting(false);
      isProcessingRef.current = false;
      return { success: false, lifeAdded: false, error: err.message };
    }
  }, []);

  return {
    grantLife,
    isGranting,
    lifeAdded,
    error,
  };
}
