import { NextResponse } from 'next/server';
import { isCheckoutProcessed } from '../../../../lib/redis/checkoutTracking.js';

/**
 * GET /api/checkout/status?checkout-id=xxx
 * Check if a checkout has been processed (life granted)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get('checkout-id');

    if (!checkoutId) {
      return NextResponse.json(
        { error: 'checkout-id parameter is required' },
        { status: 400 }
      );
    }

    const processed = await isCheckoutProcessed(checkoutId);
    
    // #region agent log
    const fs = await import('fs');
    const logPath = '/Users/andrewyang/code/satdoku/.cursor/debug.log';
    const logEntry = JSON.stringify({
      location: 'checkout/status/route.js:20',
      message: 'Checkout status check',
      data: { checkoutId, processed },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'C'
    }) + '\n';
    try { fs.appendFileSync(logPath, logEntry); } catch (e) {}
    // #endregion
    
    return NextResponse.json({
      success: true,
      processed,
      checkoutId
    });
  } catch (error) {
    // #region agent log
    const fs = await import('fs');
    const logPath = '/Users/andrewyang/code/satdoku/.cursor/debug.log';
    const logEntry = JSON.stringify({
      location: 'checkout/status/route.js:28',
      message: 'Checkout status error',
      data: { error: error.message },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'C'
    }) + '\n';
    try { fs.appendFileSync(logPath, logEntry); } catch (e) {}
    // #endregion
    console.error('[checkout/status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
