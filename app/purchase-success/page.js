'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchaseProcessing } from '../../components/hooks/usePurchaseProcessing';
import { PurchaseSuccessUI } from '../../components/PurchaseSuccessUI';

function PurchaseSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, error, isCheckoutPaidLoading, isCheckoutPaid } = usePurchaseProcessing();

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
