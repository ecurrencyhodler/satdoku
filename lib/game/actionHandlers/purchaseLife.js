import { storeGameState } from '../../redis/gameState.js';
import { isCheckoutProcessed, trackLifePurchase } from '../../supabase/purchases.js';

/**
 * Handle purchaseLife action
 * Can be called from webhook handler or directly from client when MDK confirms payment (isCheckoutPaid: true)
 */
export async function handlePurchaseLife(sessionId, state, action, currentVersion) {
  const checkoutId = action.checkoutId;

  // Require checkoutId for idempotency and security
  if (!checkoutId || typeof checkoutId !== 'string' || checkoutId.trim() === '') {
    return {
      success: false,
      error: 'Checkout ID is required',
      errorCode: 'MISSING_CHECKOUT_ID',
      version: currentVersion
    };
  }

  // Check idempotency
  const alreadyProcessed = await isCheckoutProcessed(checkoutId);
  if (alreadyProcessed) {
    console.log('[handlePurchaseLife] Checkout already processed, skipping:', checkoutId);
    return {
      success: false,
      error: 'Checkout already processed',
      errorCode: 'ALREADY_PROCESSED',
      version: currentVersion
    };
  }

  const updatedState = {
    ...state,
    lives: state.lives + 1,
    livesPurchased: (state.livesPurchased || 0) + 1
  };

  const result = await storeGameState(sessionId, updatedState, currentVersion);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version || currentVersion
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR',
      version: currentVersion
    };
  }

  // Track purchase in Supabase - must complete before marking as processed
  // This ensures idempotency: if process crashes, checkout won't be marked processed
  // and can be retried safely
  const purchaseTracked = await trackLifePurchase(checkoutId, sessionId, 'success');
  
  if (!purchaseTracked) {
    // If tracking fails, we should rollback the state change
    // However, since we can't easily rollback Redis state, we'll log the error
    // The checkout won't be marked as processed, so it can be retried
    console.error('[handlePurchaseLife] Failed to track purchase in Supabase, but state was updated. Checkout can be retried.');
    return {
      success: false,
      error: 'Failed to track purchase',
      errorCode: 'NETWORK_ERROR',
      version: result.version
    };
  }

  // Checkout is already marked as processed by trackLifePurchase (it sets the cache)
  console.log('[handlePurchaseLife] Purchase tracked and checkout marked as processed:', checkoutId);

  return {
    success: true,
    state: { ...updatedState, version: result.version },
    scoreDelta: { points: 0, events: [] },
    modals: { win: false, gameOver: false, purchaseLife: false },
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}













