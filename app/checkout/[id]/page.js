'use client';
import { Checkout } from '@moneydevkit/nextjs';
import { use, useEffect } from 'react';

export default function CheckoutPage({ params }) {
  const { id: checkoutId } = use(params);

  // Store checkout session mapping when checkout page loads
  // This ensures the mapping exists for the webhook handler
  useEffect(() => {
    if (checkoutId) {
      fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId }),
      }).catch((err) => {
        // Fail silently - if it already exists or fails, that's okay
        // The webhook handler will still work if mapping exists
        console.warn('[checkout] Failed to store checkout mapping:', err);
      });
    }
  }, [checkoutId]);

  return <Checkout id={checkoutId} />;
}

