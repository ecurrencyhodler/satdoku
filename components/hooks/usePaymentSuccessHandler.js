import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StateManager } from '../../src/js/system/localState.js';

/**
 * Hook for handling payment success and reloading game state
 * Now works with server-authoritative system
 */
export function usePaymentSuccessHandler(
  gameStateRef, // No longer needed but kept for compatibility
  gameControllerRef, // No longer needed but kept for compatibility
  isLoadingStateRef,
  setShowPurchaseModal,
  loadGameState,
  saveGameState, // No longer needed but kept for compatibility
  updateGameState // No longer needed but kept for compatibility
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const paymentSuccess = searchParams?.get('payment_success');

    if (paymentSuccess === 'true') {
      // Life was already added via purchaseLife action in purchase-success page
      // Just reload state to get the updated lives
      const handlePaymentSuccess = async () => {
        try {
          console.log('[usePaymentSuccessHandler] Reloading state after purchase');
          await loadGameState();

          // Close purchase modal if it's open
          if (setShowPurchaseModal) {
            setShowPurchaseModal(false);
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
  }, [searchParams, router, setShowPurchaseModal, loadGameState]);
}















