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
  const [isInitialized, setIsInitialized] = useState(false); // Track when initial state is loaded
  const hasProcessed = useRef(false);
  const pollingIntervalRef = useRef(null);
  const initialLivesRef = useRef(null);
  const initialLivesPurchasedRef = useRef(null);
  const pollStartTimeRef = useRef(null);
  const MAX_POLL_TIME = 60000; // 60 seconds max polling time
  const POLL_INTERVAL = 1000; // Poll every 1 second

  // Initialize initial state when payment is confirmed
  useEffect(() => {
    if (!isCheckoutPaidLoading && isCheckoutPaid && initialLivesRef.current === null) {
      const checkoutId = searchParams?.get('checkout-id');
      
      // #region agent log
      console.log('[DEBUG] Payment confirmed, initializing', { isCheckoutPaid, isCheckoutPaidLoading, checkoutId, hasProcessed: hasProcessed.current });
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:27',message:'Payment confirmed, initializing',data:{isCheckoutPaid,isCheckoutPaidLoading,checkoutId,hasProcessed:hasProcessed.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // First check if checkout was already processed on server (life already granted)
      if (checkoutId) {
        fetch(`/api/checkout/status?checkout-id=${encodeURIComponent(checkoutId)}`)
          .then(res => res.json())
          .then(data => {
            // #region agent log
            console.log('[DEBUG] Checkout status response', { checkoutId, statusData: data });
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:35',message:'Checkout status response',data:{checkoutId,statusData:data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            if (data.success && data.processed) {
              // Checkout was already processed - life should already be granted
              // Check current state to confirm
              StateManager.loadGameState().then((state) => {
                // #region agent log
                console.log('[DEBUG] State loaded after checkout processed', { checkoutId, stateExists: !!state, stateLives: state?.lives, stateLivesPurchased: state?.livesPurchased });
                fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:39',message:'State loaded after checkout processed',data:{checkoutId,stateExists:!!state,stateLives:state?.lives,stateLivesPurchased:state?.livesPurchased},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                if (state) {
                  // Life was already granted, mark as success
                  markLifeGranted(checkoutId);
                  setStatus('success');
                  hasProcessed.current = true;
                  setTimeout(() => {
                    router.push('/?payment_success=true');
                  }, 500);
                }
              });
              return;
            }
          })
          .catch(err => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:53',message:'Checkout status check failed',data:{checkoutId,error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.warn('[usePurchaseProcessing] Failed to check checkout status:', err);
            // Continue with normal flow
          });
      }
      
      // Load initial state to get starting lives count
      StateManager.loadGameState().then((state) => {
        // #region agent log
        console.log('[DEBUG] Initial state loaded', { stateExists: !!state, stateLives: state?.lives, stateLivesPurchased: state?.livesPurchased, initialLivesRef: initialLivesRef.current });
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:60',message:'Initial state loaded',data:{stateExists:!!state,stateLives:state?.lives,stateLivesPurchased:state?.livesPurchased,initialLivesRef:initialLivesRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        if (state && initialLivesRef.current === null) {
          initialLivesRef.current = state.lives || 0;
          initialLivesPurchasedRef.current = state.livesPurchased || 0;
          pollStartTimeRef.current = Date.now();
          setStatus('granting');
          setIsInitialized(true); // Mark initialization as complete
          // #region agent log
          console.log('[DEBUG] Initial state set, starting polling', { initialLives: initialLivesRef.current, initialLivesPurchased: initialLivesPurchasedRef.current, checkoutId });
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:65',message:'Initial state set, starting polling',data:{initialLives:initialLivesRef.current,initialLivesPurchased:initialLivesPurchasedRef.current,checkoutId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
        } else if (!state) {
          // No state found - still mark as initialized so polling can handle the error case
          setIsInitialized(true);
        }
      });
    }
  }, [isCheckoutPaid, isCheckoutPaidLoading, router, searchParams]);

  // Poll for life grant when payment is confirmed
  useEffect(() => {
    const checkoutId = searchParams?.get('checkout-id');
    
    // Don't poll if already processed, payment not confirmed, or initialization not complete
    if (hasProcessed.current || isCheckoutPaidLoading || !isCheckoutPaid || !isInitialized || initialLivesRef.current === null) {
      // #region agent log
      console.log('[DEBUG] Polling skipped - conditions not met', { hasProcessed: hasProcessed.current, isCheckoutPaidLoading, isCheckoutPaid, isInitialized, initialLivesRef: initialLivesRef.current });
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:75',message:'Polling skipped - conditions not met',data:{hasProcessed:hasProcessed.current,isCheckoutPaidLoading,isCheckoutPaid,isInitialized,initialLivesRef:initialLivesRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Check if already granted (client-side cache)
    if (checkoutId && isLifeGranted(checkoutId)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:80',message:'Life already granted in cache',data:{checkoutId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setStatus('success');
      hasProcessed.current = true;
      setTimeout(() => {
        router.push('/?payment_success=true');
      }, 500);
      return;
    }

    // Start polling for life grant
    const pollForLife = async () => {
      // #region agent log
      console.log('[DEBUG] Poll iteration started', { checkoutId, elapsedTime: pollStartTimeRef.current ? Date.now() - pollStartTimeRef.current : null, hasProcessed: hasProcessed.current });
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:90',message:'Poll iteration started',data:{checkoutId,elapsedTime:pollStartTimeRef.current?Date.now()-pollStartTimeRef.current:null,hasProcessed:hasProcessed.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Check if we've exceeded max poll time
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLL_TIME) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:93',message:'Poll timeout exceeded',data:{elapsedTime:Date.now()-pollStartTimeRef.current,maxPollTime:MAX_POLL_TIME},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
        // Check server-side if checkout was processed
        if (checkoutId) {
          try {
            const statusRes = await fetch(`/api/checkout/status?checkout-id=${encodeURIComponent(checkoutId)}`);
            const statusData = await statusRes.json();
            // #region agent log
            console.log('[DEBUG] Checkout status poll result', { checkoutId, statusData, statusOk: statusRes.ok });
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:108',message:'Checkout status poll result',data:{checkoutId,statusData,statusOk:statusRes.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            if (statusData.success && statusData.processed) {
              // Checkout was processed - verify life was added
              const currentState = await StateManager.loadGameState();
              // #region agent log
              console.log('[DEBUG] State loaded after processed checkout', { checkoutId, stateExists: !!currentState, currentLives: currentState?.lives, currentLivesPurchased: currentState?.livesPurchased, initialLivesPurchased: initialLivesPurchasedRef.current });
              fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:112',message:'State loaded after processed checkout',data:{checkoutId,stateExists:!!currentState,currentLives:currentState?.lives,currentLivesPurchased:currentState?.livesPurchased,initialLivesPurchased:initialLivesPurchasedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
              if (currentState) {
                const currentLivesPurchased = currentState.livesPurchased || 0;
                
                // If livesPurchased increased, life was granted
                if (currentLivesPurchased > initialLivesPurchasedRef.current) {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:118',message:'Life grant detected via status check',data:{checkoutId,initialPurchased:initialLivesPurchasedRef.current,currentPurchased:currentLivesPurchased},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                  console.log('[usePurchaseProcessing] Life granted detected via server status!', {
                    initialPurchased: initialLivesPurchasedRef.current,
                    currentPurchased: currentLivesPurchased
                  });
                  
                  markLifeGranted(checkoutId);
                  setStatus('success');
                  hasProcessed.current = true;
                  
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                  }
                  
                  setTimeout(() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:134',message:'Attempting router.push',data:{checkoutId,status:'success'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    router.push('/?payment_success=true');
                  }, 500);
                  return;
                } else {
                  // #region agent log
                  console.log('[DEBUG] Checkout processed but life not increased', { checkoutId, currentLivesPurchased, initialLivesPurchased: initialLivesPurchasedRef.current });
                  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:137',message:'Checkout processed but life not increased',data:{checkoutId,currentLivesPurchased,initialLivesPurchased:initialLivesPurchasedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion
                  // This is a critical issue: checkout is marked processed but life wasn't granted
                  // This could happen if webhook fired before session mapping was set up
                  // Continue polling - the webhook might retry or we need to investigate
                  console.error('[usePurchaseProcessing] CRITICAL: Checkout processed but life not granted!', {
                    checkoutId,
                    currentLivesPurchased,
                    initialLivesPurchased: initialLivesPurchasedRef.current
                  });
                }
              } else {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:140',message:'Checkout processed but state is null',data:{checkoutId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }
            }
          } catch (statusErr) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:141',message:'Checkout status check error',data:{checkoutId,error:statusErr.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.warn('[usePurchaseProcessing] Error checking checkout status:', statusErr);
            // Continue with state polling
          }
        }

        // Also check game state directly
        const currentState = await StateManager.loadGameState();
        // #region agent log
        console.log('[DEBUG] Direct state poll result', { stateExists: !!currentState, currentLives: currentState?.lives, currentLivesPurchased: currentState?.livesPurchased, initialLives: initialLivesRef.current, initialLivesPurchased: initialLivesPurchasedRef.current });
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:147',message:'Direct state poll result',data:{stateExists:!!currentState,currentLives:currentState?.lives,currentLivesPurchased:currentState?.livesPurchased,initialLives:initialLivesRef.current,initialLivesPurchased:initialLivesPurchasedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (currentState) {
          const currentLives = currentState.lives || 0;
          const currentLivesPurchased = currentState.livesPurchased || 0;
          
          // Check if life was added (either lives or livesPurchased increased)
          if (currentLives > initialLivesRef.current || 
              currentLivesPurchased > initialLivesPurchasedRef.current) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:155',message:'Life grant detected via direct state check',data:{checkoutId,initialLives:initialLivesRef.current,currentLives,initialPurchased:initialLivesPurchasedRef.current,currentPurchased:currentLivesPurchased},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Life was granted!
            console.log('[usePurchaseProcessing] Life granted detected!', {
              initialLives: initialLivesRef.current,
              currentLives: currentLives,
              initialPurchased: initialLivesPurchasedRef.current,
              currentPurchased: currentLivesPurchased
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
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:180',message:'Attempting router.push from direct check',data:{checkoutId,status:'success'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              router.push('/?payment_success=true');
            }, 500);
          } else {
            // #region agent log
            console.log('[DEBUG] Life not yet granted - continuing poll', { checkoutId, currentLives, initialLives: initialLivesRef.current, currentLivesPurchased, initialLivesPurchased: initialLivesPurchasedRef.current });
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:183',message:'Life not yet granted - continuing poll',data:{checkoutId,currentLives,initialLives:initialLivesRef.current,currentLivesPurchased,initialLivesPurchased:initialLivesPurchasedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:186',message:'State is null during poll',data:{checkoutId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        }
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:185',message:'Poll error',data:{checkoutId,error:err.message,stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.error('[usePurchaseProcessing] Error polling for life:', err);
        // Continue polling on error (might be transient)
      }
    };

    // Start polling
    if (!pollingIntervalRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePurchaseProcessing.js:192',message:'Starting polling interval',data:{checkoutId,pollInterval:POLL_INTERVAL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
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
  }, [isCheckoutPaid, isCheckoutPaidLoading, isInitialized, router, searchParams]);

  return {
    status,
    error,
    isCheckoutPaidLoading,
    isCheckoutPaid,
  };
}





