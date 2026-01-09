import { createClient } from 'redis';

let client;
let clientPromise;

/**
 * Get or create Redis client
 * Uses singleton pattern for Next.js serverless functions
 * Ensures client is connected before returning
 * Thread-safe: multiple concurrent calls will await the same connection promise
 */
export async function getRedisClient() {
  if (client && client.isOpen) {
    return client;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not set, Redis operations will be disabled');
    return null;
  }

  // Reset if client exists but is not open
  if (client && !client.isOpen) {
    client = null;
    clientPromise = null;
  }

  // Create new client and connection promise if needed
  // This check-then-set pattern is safe because:
  // 1. If clientPromise exists, all concurrent calls await the same promise
  // 2. If it doesn't exist, the first call creates it and others will see it
  // 3. The worst case is multiple clients created, but only one will be used
  if (!clientPromise) {
    const newClient = createClient({
      url: redisUrl,
    });

    newClient.on('error', (err) => {
      console.error('[Redis] Client error:', err);
      // Reset on critical errors
      if (err.message?.includes('Connection') || err.message?.includes('ECONNREFUSED')) {
        client = null;
        clientPromise = null;
      }
    });

    newClient.on('connect', () => {
      console.log('[Redis] Client connected');
    });

    newClient.on('reconnecting', () => {
      console.log('[Redis] Client reconnecting');
    });

    newClient.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    // Set clientPromise immediately before connecting
    // This ensures concurrent calls will see it and await the same promise
    client = newClient;
    clientPromise = client.connect().catch((error) => {
      // On connection failure, reset so retry can happen
      client = null;
      clientPromise = null;
      throw error;
    });
  }

  // Wait for connection promise (either we created it or another call did)
  // All concurrent calls will await the same promise
  try {
    await clientPromise;
    // Verify client is still open after awaiting
    if (!client || !client.isOpen) {
      client = null;
      clientPromise = null;
      return null;
    }
  } catch (error) {
    console.error('[Redis] Connection promise failed:', error);
    client = null;
    clientPromise = null;
    return null;
  }

  return client;
}

/**
 * Reset the Redis client (useful for error recovery)
 */
export function resetRedisClient() {
  client = null;
  clientPromise = null;
}

export default getRedisClient;















