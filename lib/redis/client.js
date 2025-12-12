import { createClient } from 'redis';

let client;
let clientPromise;

/**
 * Get or create Redis client
 * Uses singleton pattern for Next.js serverless functions
 * Ensures client is connected before returning
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

  // Check if we need to create a new client
  if (!clientPromise) {
    // Create client and connection promise
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

    // Set clientPromise before connecting to prevent race condition
    // If another call sets it first, we'll use that one instead
    if (!clientPromise) {
      client = newClient;
      clientPromise = client.connect();
    }
    // If clientPromise was set by another concurrent call, newClient will be garbage collected
  }
  
  // Wait for connection promise (either we created it or another call did)
  if (clientPromise) {
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
