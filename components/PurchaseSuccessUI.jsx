'use client';

/**
 * UI component for purchase success page states
 */
export function PurchaseSuccessUI({ status, error, onReturnToGame }) {
  if (status === 'error') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button 
          onClick={onReturnToGame}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Return to Game
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
      <p>
        {status === 'verifying' && 'Verifying payment…'}
        {status === 'granting' && 'Payment confirmed! Adding life to your game...'}
        {status === 'success' && 'Life added successfully! Redirecting...'}
      </p>
      {status === 'granting' && <p>Please wait...</p>}
      {status === 'success' && <p>Redirecting back to game...</p>}
    </div>
  );
}
