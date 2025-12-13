import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { useLifeGranting } from './useLifeGranting';
import { isLifeGranted, markLifeGranted, clearLifeGranted } from '../../lib/purchaseSessionStorage';

/**
 * Hook for processing purchase and granting life
 */
export function usePurchaseProcessing() {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('granting'); // 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false);
  const { grantLife, error: grantError } = useLifeGranting();

  useEffect(() => {
    // Prevent multiple calls with ref guard
    if (hasProcessed.current) {
      return;
    }
    
    const checkoutId = searchParams?.get('checkout-id');
    
    // Check if life was already granted for this checkout
    if (checkoutId && isLifeGranted(checkoutId)) {
      setStatus('success');
      setTimeout(() => {
        router.push('/?payment_success=true');
      }, 500);
      return;
    }
    
    // When payment is confirmed by MoneyDevKit, grant life
    if (!isCheckoutPaidLoading && isCheckoutPaid && status === 'granting') {
      hasProcessed.current = true;
      
      // Set sessionStorage flag IMMEDIATELY to prevent race condition
      if (checkoutId) {
        markLifeGranted(checkoutId);
      }
      
      // Grant life (pass checkoutId for tracking)
      grantLife(checkoutId || null).then((result) => {
        if (result.success && result.lifeAdded) {
          setStatus('success');
          setTimeout(() => {
            router.push('/?payment_success=true');
          }, 500);
        } else {
          // Remove sessionStorage flag on error to allow retry
          if (checkoutId) {
            clearLifeGranted(checkoutId);
          }
          const errorMessage = grantError || 'Failed to add life to your game. Please contact support.';
          setError(errorMessage);
          setStatus('error');
          hasProcessed.current = false; // Allow retry on error
        }
      }).catch((err) => {
        // Remove sessionStorage flag on error to allow retry
        if (checkoutId) {
          clearLifeGranted(checkoutId);
        }
        console.error('Unexpected error during purchase processing:', err);
        setError('An unexpected error occurred. Please contact support.');
        setStatus('error');
        hasProcessed.current = false; // Allow retry on error
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutPaid, isCheckoutPaidLoading]);

  return {
    status,
    error,
    isCheckoutPaidLoading,
    isCheckoutPaid,
  };
}





