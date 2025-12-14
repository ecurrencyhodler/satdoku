'use client';
import { Checkout } from '@moneydevkit/nextjs';
import { use, useEffect, useRef, useState } from 'react';

export default function CheckoutPage({ params }) {
  const { id: checkoutId } = use(params);
  const [mappingStored, setMappingStored] = useState(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [100, 200, 500, 1000, 2000]; // Exponential backoff in ms

  // Store checkout session mapping when checkout page loads
  // This MUST happen before payment completes to ensure webhook can find the mapping
  useEffect(() => {
    if (!checkoutId || mappingStored) {
      return;
    }

    const storeMapping = async (retryCount = 0) => {
      try {
        console.log(`[checkout] Storing session mapping (attempt ${retryCount + 1}/${MAX_RETRIES})`, { checkoutId });
        
        const response = await fetch('/api/checkout/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log('[checkout] Successfully stored session mapping', { checkoutId, sessionId: data.sessionId });
          setMappingStored(true);
          retryCountRef.current = 0;
          return;
        }

        // If mapping already exists, that's fine - mark as stored
        if (data.errorCode === 'STORAGE_ERROR' && retryCount < MAX_RETRIES - 1) {
          // Might be a transient error, retry
          throw new Error(data.error || 'Storage error');
        }

        // Non-retryable errors
        if (data.errorCode === 'INVALID_SESSION' || data.errorCode === 'INVALID_CHECKOUT_ID') {
          console.error('[checkout] Failed to store mapping - non-retryable error:', data.error);
          return;
        }

        // Retryable error - throw to trigger retry
        throw new Error(data.error || 'Failed to store mapping');
      } catch (err) {
        console.warn(`[checkout] Failed to store mapping (attempt ${retryCount + 1}):`, err.message);
        
        if (retryCount < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.log(`[checkout] Retrying in ${delay}ms...`);
          setTimeout(() => {
            storeMapping(retryCount + 1);
          }, delay);
        } else {
          console.error('[checkout] Failed to store mapping after all retries. Webhook may not be able to grant life!', {
            checkoutId,
            error: err.message
          });
          // Still mark as attempted so we don't keep retrying forever
          setMappingStored(true);
        }
      }
    };

    // Store immediately
    storeMapping(0);
  }, [checkoutId, mappingStored]);

  return <Checkout id={checkoutId} />;
}
