import { createClient } from 'redis';

let client;
let clientPromise;

/**
 * Get or create Redis client
 * Uses singleton pattern for Next.js serverless functions
 */
function getRedisClient() {
  if (client) {
    return client;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not set, Redis operations will be disabled');
    return null;
  }

  if (!clientPromise) {
    client = createClient({
      url: redisUrl,
    });

    client.on('error', (err) => {
      console.error('[Redis] Client error:', err);
    });

    client.on('connect', () => {
      console.log('[Redis] Client connected');
    });

    client.on('reconnecting', () => {
      console.log('[Redis] Client reconnecting');
    });

    clientPromise = client.connect();
  }

  return client;
}

/**
 * Store a successful payment in Redis
 * @param {string} checkoutId - The checkout session ID
 * @param {object} paymentData - Payment information to store
 * @returns {Promise<boolean>} - Success status
 */
export async function storePayment(checkoutId, paymentData) {
  try {
    const redis = getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot store payment - Redis not available');
      return false;
    }

    // Ensure client is connected
    if (clientPromise) {
      await clientPromise;
    }

    const key = `payment:${checkoutId}`;
    const value = JSON.stringify({
      ...paymentData,
      storedAt: new Date().toISOString(),
    });

    // Store payment with 30 day expiration (optional, adjust as needed)
    await redis.setEx(key, 30 * 24 * 60 * 60, value);
    
    console.log(`[Redis] Stored payment for checkout: ${checkoutId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Error storing payment:', error);
    return false;
  }
}

/**
 * Check if a payment exists in Redis
 * @param {string} checkoutId - The checkout session ID
 * @returns {Promise<object|null>} - Payment data or null if not found
 */
export async function getPayment(checkoutId) {
  try {
    const redis = getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot get payment - Redis not available');
      return null;
    }

    // Ensure client is connected
    if (clientPromise) {
      await clientPromise;
    }

    const key = `payment:${checkoutId}`;
    const value = await redis.get(key);
    
    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error('[Redis] Error getting payment:', error);
    return null;
  }
}

/**
 * Check if a payment has already been processed
 * @param {string} checkoutId - The checkout session ID
 * @returns {Promise<boolean>} - True if payment exists
 */
export async function hasPayment(checkoutId) {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return false;
    }

    // Ensure client is connected
    if (clientPromise) {
      await clientPromise;
    }

    const key = `payment:${checkoutId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('[Redis] Error checking payment:', error);
    return false;
  }
}

export default getRedisClient;
