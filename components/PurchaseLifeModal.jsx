'use client';

import { useCheckout } from '@moneydevkit/nextjs';
import { useState, useEffect } from 'react';
import { LIFE_PURCHASE_PRICE_SATS } from '../src/js/system/constants.js';

export default function PurchaseLifeModal({ isOpen, onClose, onSuccess }) {
  const { navigate, isNavigating } = useCheckout();
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset processing state when modal opens (handles case where user navigated back from checkout)
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
    }
  }, [isOpen]);

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
        successUrl: '/purchase-success',
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
          <button onClick={onClose} className="btn btn-secondary">
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}

