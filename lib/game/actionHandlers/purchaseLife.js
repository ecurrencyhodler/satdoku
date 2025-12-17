import { storeGameState } from '../../redis/gameState.js';
import { isCheckoutProcessed, markCheckoutProcessed } from '../../redis/checkoutTracking.js';

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

  // Mark checkout as processed (checkoutId is guaranteed to exist at this point)
  await markCheckoutProcessed(checkoutId);
  console.log('[handlePurchaseLife] Marked checkout as processed:', checkoutId);

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



