import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { StateManager } from '../../src/js/system/localState.js';
import { isLifeGranted, markLifeGranted } from '../../lib/purchaseSessionStorage';

/**
 * Hook for processing purchase and polling for life grant
 * Lives are now granted by webhook handler, so we poll game state to detect when life is added
 */
export function usePurchaseProcessing() {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('waiting'); // 'waiting', 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false);
  const pollingIntervalRef = useRef(null);
  const initialLivesRef = useRef(null);
  const pollStartTimeRef = useRef(null);
  const MAX_POLL_TIME = 60000; // 60 seconds max polling time
  const POLL_INTERVAL = 1000; // Poll every 1 second

  // Initialize initial lives count when payment is confirmed
  useEffect(() => {
    if (!isCheckoutPaidLoading && isCheckoutPaid && initialLivesRef.current === null) {
      // Load initial state to get starting lives count
      StateManager.loadGameState().then((state) => {
        if (state) {
          initialLivesRef.current = state.lives || 0;
          pollStartTimeRef.current = Date.now();
          setStatus('granting');
        }
      });
    }
  }, [isCheckoutPaid, isCheckoutPaidLoading]);

  // Poll for life grant when payment is confirmed
  useEffect(() => {
    const checkoutId = searchParams?.get('checkout-id');
    
    // Don't poll if already processed or if payment not confirmed
    if (hasProcessed.current || isCheckoutPaidLoading || !isCheckoutPaid || initialLivesRef.current === null) {
      return;
    }

    // Check if already granted (client-side cache)
    if (checkoutId && isLifeGranted(checkoutId)) {
      setStatus('success');
      hasProcessed.current = true;
      setTimeout(() => {
        router.push('/?payment_success=true');
      }, 500);
      return;
    }

    // Start polling for life grant
    const pollForLife = async () => {
      // Check if we've exceeded max poll time
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLL_TIME) {
        console.warn('[usePurchaseProcessing] Poll timeout - life not granted within time limit');
        setError('Life grant is taking longer than expected. Please refresh the page.');
        setStatus('error');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const currentState = await StateManager.loadGameState();
        
        if (currentState) {
          const currentLives = currentState.lives || 0;
          
          // Check if life was added (webhook granted it)
          if (currentLives > initialLivesRef.current) {
            // Life was granted!
            console.log('[usePurchaseProcessing] Life granted detected!', {
              initial: initialLivesRef.current,
              current: currentLives
            });
            
            // Mark as granted in sessionStorage
            if (checkoutId) {
              markLifeGranted(checkoutId);
            }
            
            setStatus('success');
            hasProcessed.current = true;
            
            // Clear polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            // Redirect to game
            setTimeout(() => {
              router.push('/?payment_success=true');
            }, 500);
          }
        }
      } catch (err) {
        console.error('[usePurchaseProcessing] Error polling for life:', err);
        // Continue polling on error (might be transient)
      }
    };

    // Start polling
    if (!pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(pollForLife, POLL_INTERVAL);
      // Also poll immediately
      pollForLife();
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isCheckoutPaid, isCheckoutPaidLoading, router, searchParams]);

  return {
    status,
    error,
    isCheckoutPaidLoading,
    isCheckoutPaid,
  };
}





