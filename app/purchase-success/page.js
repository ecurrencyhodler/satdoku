'use client';

import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchaseVerification } from '../../components/hooks/usePurchaseVerification';
import { useLifeGranting } from '../../components/hooks/useLifeGranting';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

function PurchaseSuccessContent() {
  const { isCheckoutPaidLoading, isCheckoutPaid, metadata } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false); // Guard to prevent multiple processPurchase calls

  const { verifyPurchase, isVerifying, error: verifyError } = usePurchaseVerification();
  const { grantLife, isGranting, lifeAdded, error: grantError } = useLifeGranting();

  const processPurchase = async (checkoutId) => {
    try {
      // Step 1: Verify purchase
      const verified = await verifyPurchase(checkoutId);
      if (!verified) {
        const errorMessage = verifyError || 'Purchase verification failed. Please try again or contact support.';
        setError(errorMessage);
        setStatus('error');
        return;
      }

      // Step 2: Grant life
      setStatus('granting');
      const result = await grantLife(checkoutId);
      if (!result.success) {
        const errorMessage = grantError || 'Failed to add life to your game. Please contact support with your checkout ID.';
        setError(errorMessage);
        setStatus('error');
        return;
      }

      // Step 3: Success - redirect
      setStatus('success');
      setTimeout(() => {
        router.push(result.lifeAdded ? '/?payment_success=true' : '/');
      }, 1500);
    } catch (err) {
      console.error('Unexpected error during purchase processing:', err);
      setError('An unexpected error occurred. Please contact support with your checkout ID.');
      setStatus('error');
    }
  };

  useEffect(() => {
    // Prevent multiple calls with ref guard
    if (hasProcessed.current) return;
    
    if (!isCheckoutPaidLoading && isCheckoutPaid && status === 'verifying') {
      // Get checkout ID from multiple sources:
      // 1. URL search params (if MoneyDevKit includes it)
      // 2. Metadata from useCheckoutSuccess
      // 3. Check if useCheckoutSuccess provides checkoutId directly
      const checkoutId = 
        searchParams?.get('checkout_id') || 
        searchParams?.get('id') ||
        metadata?.checkoutId ||
        metadata?.id ||
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('checkout_id')) ||
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id'));
      
      // Validate checkout ID format (should be a non-empty string)
      const isValidCheckoutId = checkoutId && 
        typeof checkoutId === 'string' && 
        checkoutId.trim().length > 0;
      
      if (isValidCheckoutId) {
        hasProcessed.current = true;
        processPurchase(checkoutId.trim());
      } else {
        // If checkout ID not found or invalid, cannot verify purchase
        console.warn('Checkout ID not found or invalid in URL or metadata:', { checkoutId, metadata });
        setError('Checkout ID not found. Please contact support if payment was successful.');
        setStatus('error');
        hasProcessed.current = true; // Prevent retries
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutPaid, isCheckoutPaidLoading, status]);

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

