'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchaseProcessing } from '../../components/hooks/usePurchaseProcessing';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

function PurchaseSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, error, isCheckoutPaidLoading, isCheckoutPaid } = usePurchaseProcessing();

  // Store checkout session mapping when page loads
  useEffect(() => {
    const checkoutId = searchParams?.get('checkout-id');
    if (checkoutId) {
      // Call init endpoint to store checkoutId -> sessionId mapping
      // This ensures the mapping exists for the webhook handler
      fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId }),
      }).catch((err) => {
        // Fail silently - if it already exists or fails, that's okay
        // The webhook handler will still work if mapping exists
        console.warn('[purchase-success] Failed to store checkout mapping:', err);
      });
    }
  }, [searchParams]);

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

