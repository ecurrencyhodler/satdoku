import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { StateManager } from '../../src/js/system/localState.js';
import { isLifeGranted, markLifeGranted } from '../../lib/purchaseSessionStorage';

/**
 * Hook for processing purchase and granting life
 * When MDK returns isCheckoutPaid: true, directly grant life on the server
 *
 * Simplified: No longer coordinates with webhook - only relies on client-side confirmation
 */
export function usePurchaseProcessing() {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('waiting'); // 'waiting', 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false);

  // Process payment when confirmed - route by payment type
  useEffect(() => {
    if (!isCheckoutPaidLoading && isCheckoutPaid && !hasProcessed.current) {
      const checkoutId = searchParams?.get('checkout-id');
      const paymentType = searchParams?.get('type') || 'life_purchase';

      console.log('[usePurchaseProcessing] Payment confirmed', { checkoutId, isCheckoutPaid, paymentType });

      if (!checkoutId) {
        console.error('[usePurchaseProcessing] No checkout ID found in URL');
        setError('Invalid checkout ID');
        setStatus('error');
        return;
      }

      // Route to appropriate payment processor
      if (paymentType === 'tutor_chat') {
        processTutorChatPayment(checkoutId);
      } else {
        processLifePurchase(checkoutId);
      }
    }
  }, [isCheckoutPaid, isCheckoutPaidLoading, router, searchParams]);

  // Process tutor chat payment
  const processTutorChatPayment = (checkoutId) => {
    setStatus('granting');

    // Check if already processed on server (idempotency check)
    fetch(`/api/checkout/status?checkout-id=${encodeURIComponent(checkoutId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.processed) {
          // Already processed - redirect to game with chat open
          console.log('[usePurchaseProcessing] Tutor chat payment already processed');
          setStatus('success');
          hasProcessed.current = true;
          setTimeout(() => {
            router.push('/?tutor_chat_open=true');
          }, 500);
          return;
        }

        // Process tutor chat payment
        fetch('/api/tutor/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log('[usePurchaseProcessing] Tutor chat payment processed successfully');
              setStatus('success');
              hasProcessed.current = true;
              setTimeout(() => {
                router.push('/?tutor_chat_open=true');
              }, 500);
            } else {
              console.error('[usePurchaseProcessing] Failed to process tutor chat payment:', data.error);
              setError(data.error || 'Failed to unlock conversation');
              setStatus('error');
            }
          })
          .catch(err => {
            console.error('[usePurchaseProcessing] Error processing tutor chat payment:', err);
            setError('Network error while processing payment');
            setStatus('error');
          });
      })
      .catch(err => {
        console.error('[usePurchaseProcessing] Error checking checkout status:', err);
        // Continue with processing anyway
        fetch('/api/tutor/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setStatus('success');
              hasProcessed.current = true;
              setTimeout(() => {
                router.push('/?tutor_chat_open=true');
              }, 500);
            } else {
              setError(data.error || 'Failed to unlock conversation');
              setStatus('error');
            }
          })
          .catch(err => {
            setError('Network error while processing payment');
            setStatus('error');
          });
      });
  };

  // Process life purchase (existing logic)
  const processLifePurchase = (checkoutId) => {
    // Check if already granted (client-side cache)
    if (isLifeGranted(checkoutId)) {
      console.log('[usePurchaseProcessing] Life already granted (cached)');
      setStatus('success');
      hasProcessed.current = true;
      setTimeout(() => {
        router.push('/?payment_success=true');
      }, 500);
      return;
    }

      // Grant life function - defined before use
      const grantLife = (checkoutId) => {
        setStatus('granting');

        // Load current state to get version for optimistic locking
        StateManager.loadGameState()
          .then((state) => {
            if (!state) {
              console.error('[usePurchaseProcessing] No game state found');
              setError('No game state found');
              setStatus('error');
              return;
            }

            // Grant life via server action
            StateManager.sendGameAction(
              { action: 'purchaseLife', checkoutId },
              state.version
            )
              .then((result) => {
                if (result.success) {
                  console.log('[usePurchaseProcessing] Life granted successfully');
                  markLifeGranted(checkoutId);
                  setStatus('success');
                  hasProcessed.current = true;

                  setTimeout(() => {
                    router.push('/?payment_success=true');
                  }, 500);
                } else {
                  // Handle specific error codes
                  if (result.errorCode === 'ALREADY_PROCESSED') {
                    // Already processed (e.g., by another tab or retry)
                    console.log('[usePurchaseProcessing] Life already granted');
                    markLifeGranted(checkoutId);
                    setStatus('success');
                    hasProcessed.current = true;
                    setTimeout(() => {
                      router.push('/?payment_success=true');
                    }, 500);
                  } else if (result.errorCode === 'VERSION_CONFLICT') {
                    // Version conflict - retry once with fresh state
                    console.log('[usePurchaseProcessing] Version conflict, retrying...');
                    StateManager.loadGameState()
                      .then((retryState) => {
                        if (retryState) {
                          StateManager.sendGameAction(
                            { action: 'purchaseLife', checkoutId },
                            retryState.version
                          )
                            .then((retryResult) => {
                              if (retryResult.success) {
                                markLifeGranted(checkoutId);
                                setStatus('success');
                                hasProcessed.current = true;
                                setTimeout(() => {
                                  router.push('/?payment_success=true');
                                }, 500);
                              } else {
                                setError(retryResult.error || 'Failed to grant life');
                                setStatus('error');
                              }
                            })
                            .catch((err) => {
                              console.error('[usePurchaseProcessing] Error on retry:', err);
                              setError('Network error while granting life');
                              setStatus('error');
                            });
                        } else {
                          setError('Failed to load game state for retry');
                          setStatus('error');
                        }
                      })
                      .catch((err) => {
                        console.error('[usePurchaseProcessing] Error loading state for retry:', err);
                        setError('Failed to load game state');
                        setStatus('error');
                      });
                  } else {
                    console.error('[usePurchaseProcessing] Failed to grant life:', result.error);
                    setError(result.error || 'Failed to grant life');
                    setStatus('error');
                  }
                }
              })
              .catch((err) => {
                console.error('[usePurchaseProcessing] Error granting life:', err);
                setError('Network error while granting life');
                setStatus('error');
              });
          })
          .catch((err) => {
            console.error('[usePurchaseProcessing] Error loading game state:', err);
            setError('Failed to load game state');
            setStatus('error');
          });
      };

    // Check if already processed on server (idempotency check)
    fetch(`/api/checkout/status?checkout-id=${encodeURIComponent(checkoutId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.processed) {
          // Already processed - mark as success and redirect
          console.log('[usePurchaseProcessing] Checkout already processed');
          markLifeGranted(checkoutId);
          setStatus('success');
          hasProcessed.current = true;
          setTimeout(() => {
            router.push('/?payment_success=true');
          }, 500);
          return;
        }

        // Not yet processed - grant life
        grantLife(checkoutId);
      })
      .catch(err => {
        console.error('[usePurchaseProcessing] Error checking checkout status:', err);
        // Continue with granting life anyway (status check is just for idempotency)
        grantLife(checkoutId);
      });
  };

  return {
    status,
    error,
    isCheckoutPaidLoading,
    isCheckoutPaid,
  };
}















