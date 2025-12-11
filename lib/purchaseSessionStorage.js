/**
 * Utility functions for managing purchase session storage
 * Prevents duplicate life grants for the same checkout
 */

/**
 * Get session key for a checkout ID
 */
function getSessionKey(checkoutId) {
  return `life_granted_${checkoutId}`;
}

/**
 * Check if life has already been granted for this checkout
 */
export function isLifeGranted(checkoutId) {
  if (!checkoutId) return false;
  return sessionStorage.getItem(getSessionKey(checkoutId)) === 'true';
}

/**
 * Mark that life has been granted for this checkout
 */
export function markLifeGranted(checkoutId) {
  if (!checkoutId) return;
  sessionStorage.setItem(getSessionKey(checkoutId), 'true');
}

/**
 * Remove the granted flag (for error recovery/retry)
 */
export function clearLifeGranted(checkoutId) {
  if (!checkoutId) return;
  sessionStorage.removeItem(getSessionKey(checkoutId));
}

