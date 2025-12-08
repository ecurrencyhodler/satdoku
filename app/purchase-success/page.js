'use client';

import { useCheckoutSuccess } from '@moneydevkit/nextjs';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchaseVerification } from '../../components/hooks/usePurchaseVerification';
import { useLifeGranting } from '../../components/hooks/useLifeGranting';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

export default function PurchaseSuccessPage() {
  const { isCheckoutPaidLoading, isCheckoutPaid, metadata } = useCheckoutSuccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'granting', 'success', 'error'
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false); // Guard to prevent multiple processPurchase calls

  const { verifyPurchase, isVerifying, error: verifyError } = usePurchaseVerification();
  const { grantLife, isGranting, lifeAdded, error: grantError } = useLifeGranting();

  const processPurchase = async (checkoutId) => {
    // Step 1: Verify purchase
    const verified = await verifyPurchase(checkoutId);
    if (!verified) {
      setError(verifyError);
      setStatus('error');
      return;
    }

    // Step 2: Grant life
    setStatus('granting');
    const result = await grantLife(checkoutId);
    if (!result.success) {
      setError(grantError);
      setStatus('error');
      return;
    }

    // Step 3: Success - redirect
    setStatus('success');
    setTimeout(() => {
      router.push(result.lifeAdded ? '/?payment_success=true' : '/');
    }, 1500);
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
      
      if (checkoutId) {
        hasProcessed.current = true;
        processPurchase(checkoutId);
      } else {
        // If checkout ID not found, cannot verify purchase
        console.warn('Checkout ID not found in URL or metadata');
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

