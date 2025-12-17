'use client';
import { Checkout } from '@moneydevkit/nextjs';
import { use } from 'react';

/**
 * MDK Checkout page
 *
 * Life purchases are now handled client-side via isCheckoutPaid from useCheckoutSuccess().
 * No need to store checkout session mapping anymore.
 */
export default function CheckoutPage({ params }) {
  const { id: checkoutId } = use(params);

  return <Checkout id={checkoutId} />;
}
