import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StateManager } from '../../src/js/system/localState.js';

/**
 * Hook for handling payment success and reloading game state
 */
export function usePaymentSuccessHandler(
  gameStateRef,
  gameControllerRef,
  isLoadingStateRef,
  setShowPurchaseModal,
  loadGameState,
  saveGameState,
  updateGameState
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const paymentSuccess = searchParams?.get('payment_success');
    
    if (paymentSuccess === 'true') {
      // Life was already added in purchase-success page
      // IMPORTANT: Save any unsaved moves before reloading to prevent data loss
      const handlePaymentSuccess = async () => {
        try {
          // Save current state first to preserve any unsaved moves
          // This prevents losing moves made between purchase completion and redirect
          let stateLoaded = false;
          if (gameStateRef.current.gameInProgress) {
            console.log('[usePaymentSuccessHandler] Saving state before reloading after purchase');
            const saveResult = await saveGameState();
            
            // If save succeeded, state is already synced (including lives synced during conflict resolution if any)
            // Only reload if save failed to ensure we at least get the purchased life
            if (!saveResult.success) {
              console.log('[usePaymentSuccessHandler] Save failed, reloading to get purchased life and latest state');
              stateLoaded = await loadGameState();
            } else {
              // Save succeeded - state is already up to date, just ensure UI reflects current state
              // (conflict handler already called updateGameState() if there was a conflict)
              console.log('[usePaymentSuccessHandler] Save succeeded, state is already synced');
              updateGameState();
              stateLoaded = true; // State is loaded in memory, just didn't reload from storage
            }
          } else {
            // No game in progress, just reload to get the purchased life
            stateLoaded = await loadGameState();
          }
          
          if (stateLoaded) {
            // Reset purchase modal trigger flag since life was added
            if (gameControllerRef.current) {
              gameControllerRef.current.resetPurchaseModalTrigger();
            }
            // Close purchase modal if it's open
            if (setShowPurchaseModal) {
              setShowPurchaseModal(false);
            }
          }
        } catch (error) {
          console.error('[usePaymentSuccessHandler] Error handling payment success:', error);
          // Even on error, try to reload state to get the purchased life
          try {
            await loadGameState();
          } catch (reloadError) {
            console.error('[usePaymentSuccessHandler] Failed to reload state after error:', reloadError);
          }
        } finally {
          // Clean up URL param after state is loaded
          router.replace('/');
        }
      };
      
      handlePaymentSuccess();
    }
  }, [searchParams, router, setShowPurchaseModal, gameStateRef, gameControllerRef, loadGameState, saveGameState, updateGameState]);
}
