'use client';

import { useCheckout } from '@moneydevkit/nextjs';
import { useState } from 'react';
import { LIFE_PURCHASE_PRICE_SATS } from '../src/js/system/constants.js';

export default function PurchaseLifeModal({ isOpen, onClose, onSuccess }) {
  const { navigate, isNavigating } = useCheckout();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = () => {
    setIsProcessing(true);
    navigate({
      title: 'Satdoku',
      description: 'Buy a life to keep playing',
      amount: LIFE_PURCHASE_PRICE_SATS,
      currency: 'SAT', // Amount is in satoshis
      metadata: {
        type: 'life_purchase',
        successUrl: '/purchase-success?checkout_id={CHECKOUT_ID}',
      },
    });
  };

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Out of Lives!</h2>
        <p>Purchase a life to continue playing.</p>
        <div className="modal-actions">
          <button
            onClick={handlePurchase}
            className="btn btn-primary"
            disabled={isNavigating || isProcessing}
          >
            {isNavigating || isProcessing ? 'Creating checkout…' : `Keep Playing (${LIFE_PURCHASE_PRICE_SATS} sats)`}
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={isNavigating || isProcessing}>
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}

