'use client';

/**
 * UI component for purchase success page states
 */
export function PurchaseSuccessUI({ status, error, paymentType = 'life_purchase', onReturnToGame }) {
  if (status === 'error') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <div style={{
          border: '2px solid #ff4444',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#fff5f5',
          width: '100%'
        }}>
          <h2 style={{ color: '#cc0000', marginTop: 0, marginBottom: '15px' }}>
            Payment Processing Error
          </h2>
          <p style={{ color: '#333', marginBottom: '15px', lineHeight: '1.6' }}>
            {error || 'An unexpected error occurred while processing your purchase.'}
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            If your payment was successful, please contact support with your checkout ID.
            {paymentType === 'tutor_chat'
              ? ' Your payment will be verified and you\'ll be able to chat with Howie again.'
              : ' Your payment will be verified and the life will be added to your account.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={onReturnToGame}
              style={{
                padding: '12px 24px',
                cursor: 'pointer',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Return to Game
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                cursor: 'pointer',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <p style={{ fontSize: '18px', marginBottom: '10px' }}>
          {status === 'verifying' && 'Verifying payment…'}
          {status === 'granting' && (
            paymentType === 'tutor_chat'
              ? 'Payment confirmed! Unlocking Howie chat...'
              : 'Payment confirmed! Adding life to your game...'
          )}
          {status === 'success' && (
            paymentType === 'tutor_chat'
              ? 'Another chat with Howie unlocked! Redirecting...'
              : 'Life added successfully! Redirecting...'
          )}
        </p>
        {status === 'granting' && (
          <p style={{ color: '#666', fontSize: '14px' }}>
            {paymentType === 'tutor_chat'
              ? 'Please wait while we unlock your chat...'
              : 'Please wait while we update your game...'}
          </p>
        )}
        {status === 'success' && (
          <p style={{ color: '#666', fontSize: '14px' }}>Redirecting back to game...</p>
        )}
        {(status === 'verifying' || status === 'granting') && (
          <div style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
