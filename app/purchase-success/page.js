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
      }, 10);
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
      // 1. URL search params (MoneyDevKit may use 'checkout-id' with hyphen or 'checkout_id' with underscore)
      // 2. Metadata from useCheckoutSuccess
      // 3. Check if useCheckoutSuccess provides checkoutId directly
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const checkoutId = 
        searchParams?.get('checkout-id') ||  // MoneyDevKit uses hyphen
        searchParams?.get('checkout_id') || 
        searchParams?.get('id') ||
        urlParams?.get('checkout-id') ||
        urlParams?.get('checkout_id') ||
        urlParams?.get('id') ||
        metadata?.checkoutId ||
        metadata?.id;
      
      // Validate checkout ID format (should be a non-empty string and not a template variable)
      const trimmedId = checkoutId && typeof checkoutId === 'string' ? checkoutId.trim() : '';
      // MoneyDevKit checkout IDs are alphanumeric strings (e.g., "cmixbzzgu001nad0101qqxv87")
      // Reject template variables, empty strings, and obviously invalid formats
      const isValidCheckoutId = trimmedId.length > 0 && 
        trimmedId.length >= 10 && // Reasonable minimum length
        trimmedId.length <= 100 && // Reasonable maximum length
        !trimmedId.includes('{') && // Reject template variables like {CHECKOUT_ID}
        !trimmedId.includes('}') &&
        /^[a-zA-Z0-9_-]+$/.test(trimmedId); // Only allow alphanumeric, underscore, and hyphen
      
      if (isValidCheckoutId) {
        hasProcessed.current = true;
        processPurchase(trimmedId);
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

