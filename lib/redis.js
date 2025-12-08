import { createClient } from 'redis';

let redis = null;
let isConnecting = false;

/**
 * Get or create Redis client (singleton pattern for Next.js)
 * Works with Vercel Redis
 */
async function getRedisClient() {
  if (redis && redis.isOpen) {
    return redis;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  isConnecting = true;

  try {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required. Make sure Redis is configured in your Vercel project settings.');
    }

    redis = createClient({
      url: redisUrl,
    });

    redis.on('error', (err) => console.error('Redis Client Error', err));
    
    await redis.connect();
    
    isConnecting = false;
    return redis;
  } catch (error) {
    isConnecting = false;
    throw error;
  }
}

/**
 * Set a key-value pair with optional expiration (in seconds)
 */
export async function set(key, value, options = {}) {
  const client = await getRedisClient();
  if (options.ex) {
    // Redis SETEX command: set with expiration in seconds
    await client.setEx(key, options.ex, String(value));
  } else {
    await client.set(key, String(value));
  }
}

/**
 * Get a value by key
 */
export async function get(key) {
  const client = await getRedisClient();
  const value = await client.get(key);
  return value ? (isNaN(value) ? value : Number(value)) : null;
}

/**
 * Delete a key
 */
export async function del(key) {
  const client = await getRedisClient();
  await client.del(key);
}
