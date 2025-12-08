'use client';

import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useLifeGranting } from '../../components/hooks/useLifeGranting';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

function PurchaseSuccessContent() {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const router = useRouter();
  const [status, setStatus] = useState('granting'); // 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false); // Guard to prevent multiple processPurchase calls

  const { grantLife, isGranting, lifeAdded, error: grantError } = useLifeGranting();

  useEffect(() => {
    // Prevent multiple calls with ref guard
    if (hasProcessed.current) return;
    
    // When payment is confirmed by MoneyDevKit, immediately grant life
    if (!isCheckoutPaidLoading && isCheckoutPaid && status === 'granting') {
      hasProcessed.current = true;
      
      // Grant life immediately (no verification needed - MoneyDevKit already verified)
      grantLife().then((result) => {
        if (result.success) {
          setStatus('success');
          // Redirect to game with payment success flag
          setTimeout(() => {
            router.push(result.lifeAdded ? '/?payment_success=true' : '/');
          }, 500);
        } else {
          const errorMessage = grantError || 'Failed to add life to your game. Please contact support.';
          setError(errorMessage);
          setStatus('error');
        }
      }).catch((err) => {
        console.error('Unexpected error during purchase processing:', err);
        setError('An unexpected error occurred. Please contact support.');
        setStatus('error');
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

