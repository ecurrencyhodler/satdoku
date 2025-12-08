'use client';

import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLifeGranting } from '../../components/hooks/useLifeGranting';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

function PurchaseSuccessContent() {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('granting'); // 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false); // Guard to prevent multiple processPurchase calls

  const { grantLife, isGranting, lifeAdded, error: grantError } = useLifeGranting();

  useEffect(() => {
    // Prevent multiple calls with ref guard
    if (hasProcessed.current) return;
    
    // Get checkout ID from URL to create unique session key
    const checkoutId = searchParams?.get('checkout-id');
    
    // Check sessionStorage to prevent duplicate grants (persists across remounts)
    if (checkoutId) {
      const sessionKey = `life_granted_${checkoutId}`;
      if (sessionStorage.getItem(sessionKey)) {
        console.log('[purchase-success] Life already granted for this checkout, skipping');
        setStatus('success');
        setTimeout(() => {
          router.push('/?payment_success=true');
        }, 500);
        return;
      }
    }
    
    // When payment is confirmed by MoneyDevKit, grant life
    if (!isCheckoutPaidLoading && isCheckoutPaid && status === 'granting') {
      hasProcessed.current = true;
      
      // Set sessionStorage flag IMMEDIATELY to prevent race condition
      // This must happen BEFORE grantLife() to prevent duplicate grants
      if (checkoutId) {
        const sessionKey = `life_granted_${checkoutId}`;
        sessionStorage.setItem(sessionKey, 'true');
      }
      
      // Grant life
      grantLife().then((result) => {
        if (result.success && result.lifeAdded) {
          setStatus('success');
          // Redirect to game with payment success flag
          setTimeout(() => {
            router.push('/?payment_success=true');
          }, 500);
        } else {
          // Remove sessionStorage flag on error to allow retry
          if (checkoutId) {
            const sessionKey = `life_granted_${checkoutId}`;
            sessionStorage.removeItem(sessionKey);
          }
          const errorMessage = grantError || 'Failed to add life to your game. Please contact support.';
          setError(errorMessage);
          setStatus('error');
          hasProcessed.current = false; // Allow retry on error
        }
      }).catch((err) => {
        // Remove sessionStorage flag on error to allow retry
        if (checkoutId) {
          const sessionKey = `life_granted_${checkoutId}`;
          sessionStorage.removeItem(sessionKey);
        }
        console.error('Unexpected error during purchase processing:', err);
        setError('An unexpected error occurred. Please contact support.');
        setStatus('error');
        hasProcessed.current = false; // Allow retry on error
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutPaid, isCheckoutPaidLoading]);

  if (isCheckoutPaidLoading || isCheckoutPaid === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Verifying payment…</p>
      </div>
    );
  }

  if (!isCheckoutPaid) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Payment has not been confirmed.</p>
      </div>
    );
  }

  return (
    <PurchaseSuccessUI
      status={status}
      error={error}
      onReturnToGame={() => router.push('/')}
    />
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  );
}

