import { getRedisClient, resetRedisClient } from './client.js';

const CHECKOUT_SESSION_PREFIX = 'checkout:';
const PROCESSED_CHECKOUT_PREFIX = 'processed_checkout:';
const CHECKOUT_TTL = 24 * 60 * 60; // 24 hours
const PROCESSED_CHECKOUT_TTL = 90 * 24 * 60 * 60; // 90 days (keep longer for audit)

/**
 * Store checkout to session mapping
 * @param {string} checkoutId - The checkout ID
 * @param {string} sessionId - The session ID
 * @returns {Promise<boolean>} - Success status
 */
export async function storeCheckoutSession(checkoutId, sessionId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[checkoutTracking] Cannot store checkout session - Redis not available');
      return false;
    }

    const key = `${CHECKOUT_SESSION_PREFIX}${checkoutId}`;
    await redis.setEx(key, CHECKOUT_TTL, sessionId);
    
    console.log(`[checkoutTracking] Stored checkout session mapping: ${checkoutId} -> ${sessionId}`);
    return true;
  } catch (error) {
    console.error('[checkoutTracking] Error storing checkout session:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}

/**
 * Get session ID for a checkout
 * @param {string} checkoutId - The checkout ID
 * @returns {Promise<string|null>} - Session ID or null if not found
 */
export async function getCheckoutSession(checkoutId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[checkoutTracking] Cannot get checkout session - Redis not available');
      return null;
    }

    const key = `${CHECKOUT_SESSION_PREFIX}${checkoutId}`;
    const sessionId = await redis.get(key);
    
    return sessionId;
  } catch (error) {
    console.error('[checkoutTracking] Error getting checkout session:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return null;
  }
}

/**
 * Check if a checkout has already been processed
 * @param {string} checkoutId - The checkout ID
 * @returns {Promise<boolean>} - True if already processed
 */
export async function isCheckoutProcessed(checkoutId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[checkoutTracking] Cannot check processed checkout - Redis not available');
      return false;
    }

    const key = `${PROCESSED_CHECKOUT_PREFIX}${checkoutId}`;
    const processed = await redis.get(key);
    
    return processed === 'true';
  } catch (error) {
    console.error('[checkoutTracking] Error checking processed checkout:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}

/**
 * Mark a checkout as processed
 * @param {string} checkoutId - The checkout ID
 * @returns {Promise<boolean>} - Success status
 */
export async function markCheckoutProcessed(checkoutId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[checkoutTracking] Cannot mark checkout as processed - Redis not available');
      return false;
    }

    const key = `${PROCESSED_CHECKOUT_PREFIX}${checkoutId}`;
    await redis.setEx(key, PROCESSED_CHECKOUT_TTL, 'true');
    
    console.log(`[checkoutTracking] Marked checkout as processed: ${checkoutId}`);
    return true;
  } catch (error) {
    console.error('[checkoutTracking] Error marking checkout as processed:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}