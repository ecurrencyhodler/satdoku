import { useState, useCallback } from 'react';

/**
 * Hook for handling purchase verification with retry logic
 */
export function usePurchaseVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);

  const verifyPurchase = useCallback(async (checkoutId, retryCount = 0) => {
    try {
      setIsVerifying(true);
      setError(null);
      
      // Verify purchase with server (checks Vercel KV)
      const verifyResponse = await fetch('/api/purchase/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        
        // If token not found and we haven't retried, wait and retry (webhook might be delayed)
        if (verifyResponse.status === 404 && retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          return verifyPurchase(checkoutId, retryCount + 1);
        }
        
        setError(errorData.error || 'Purchase verification failed');
        setIsVerifying(false);
        return false;
      }

      const result = await verifyResponse.json();
      setIsVerifying(false);
      setError(null);
      return result.success === true;
    } catch (err) {
      console.error('Purchase verification failed:', err);
      setError(err.message);
      setIsVerifying(false);
      return false;
    }
  }, []);

  return {
    verifyPurchase,
    isVerifying,
    error,
  };
}
