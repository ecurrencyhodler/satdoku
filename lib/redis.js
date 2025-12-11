import { createClient } from 'redis';

let redisClient = null;

/**
 * Get or create Redis client singleton
 * Connects automatically using Vercel Redis environment variables
 */
export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Create client - Vercel Redis provides connection via env vars
  // Supports both standard Redis (REDIS_URL) and Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN)
  const config = {};
  
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // Vercel KV REST API format
    config.url = process.env.KV_REST_API_URL;
    config.password = process.env.KV_REST_API_TOKEN;
  } else if (process.env.REDIS_URL) {
    // Standard Redis URL format
    config.url = process.env.REDIS_URL;
  } else {
    throw new Error('Redis connection not configured. Set REDIS_URL or KV_REST_API_URL/KV_REST_API_TOKEN');
  }

  redisClient = createClient(config);

  // Handle connection errors
  redisClient.on('error', (err) => {
    console.error('[Redis] Client error:', err);
  });

  // Connect to Redis
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Generate idempotency key from webhook event
 */
export function generateIdempotencyKey(eventData) {
  // Use checkout session ID as idempotency key if available
  if (eventData?.data?.object?.id) {
    return `webhook:${eventData.data.object.id}`;
  }
  
  // Fallback to event ID if available
  if (eventData?.id) {
    return `webhook:${eventData.id}`;
  }
  
  // Last resort: use timestamp + hash of body
  const bodyStr = JSON.stringify(eventData);
  const hash = Buffer.from(bodyStr).toString('base64').slice(0, 16);
  return `webhook:${Date.now()}:${hash}`;
}

/**
 * Extract essential payment fields from webhook event data
 * Only stores what's needed for payment verification and idempotency
 */
export function extractPaymentData(eventData) {
  const session = eventData?.data?.object;
  
  return {
    // Essential for idempotency
    checkoutSessionId: session?.id,
    eventId: eventData?.id,
    eventType: eventData?.type,
    
    // Payment verification fields
    paymentStatus: session?.payment_status,
    amount: session?.amount_total, // Amount in smallest currency unit (sats)
    currency: session?.currency,
    
    // Metadata for verification
    metadataType: session?.metadata?.type, // Should be 'life_purchase'
    
    // Timestamps
    createdAt: session?.created,
    paidAt: session?.paid_at,
    
    // Additional useful fields
    customerEmail: session?.customer_email,
    customerId: session?.customer,
  };
}

