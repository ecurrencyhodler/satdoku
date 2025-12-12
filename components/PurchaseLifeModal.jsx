'use client';

import { useCheckout } from '@moneydevkit/nextjs';
import { useState, useEffect, useRef } from 'react';
import { LIFE_PURCHASE_PRICE_SATS } from '../src/js/system/constants.js';

export default function PurchaseLifeModal({ isOpen, onClose, onSuccess }) {
  const { navigate, isNavigating } = useCheckout();
  const [isProcessing, setIsProcessing] = useState(false);
  const hasInitiatedNavigation = useRef(false);

  // Reset processing state when modal opens (handles case where user navigated back from checkout)
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      hasInitiatedNavigation.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurchase = () => {
    setIsProcessing(true);
    hasInitiatedNavigation.current = true;
    navigate({
      title: 'Satdoku',
      description: 'Buy a life to keep playing',
      amount: LIFE_PURCHASE_PRICE_SATS,
      currency: 'SAT', // Amount is in satoshis
      metadata: {
        type: 'life_purchase',
        successUrl: '/purchase-success?checkout-id={CHECKOUT_ID}',
      },
    });
  };

  // Only disable if we've actually initiated navigation in this session
  const isActuallyNavigating = isNavigating && hasInitiatedNavigation.current;
  const isDisabled = isActuallyNavigating || isProcessing;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Out of Lives!</h2>
        <p>Purchase a life to continue playing.</p>
        <div className="modal-actions">
          <button
            onClick={handlePurchase}
            className="btn btn-primary"
            disabled={isDisabled}
          >
            {isDisabled ? 'Creating checkout…' : `Keep Playing (${LIFE_PURCHASE_PRICE_SATS} sats)`}
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}

