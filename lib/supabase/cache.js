import { getRedisClient } from '../redis/client.js';

/**
 * Cache utility functions for write-through cache pattern
 */

/**
 * Get value from Redis cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
export async function getCache(key) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const value = await client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`[Cache] Error getting cache key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in Redis cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function setCache(key, value, ttlSeconds = null) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }

    return true;
  } catch (error) {
    console.error(`[Cache] Error setting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cache key
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCache(key) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    await client.del(key);
    return true;
  } catch (error) {
    console.error(`[Cache] Error deleting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Cache-first read pattern: Check Redis, fallback to Supabase, then cache result
 * @param {string} cacheKey - Redis cache key
 * @param {Function} fetchFromSupabase - Async function that fetches from Supabase
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @returns {Promise<any>} - Cached or fetched value
 */
export async function cacheFirst(cacheKey, fetchFromSupabase, ttlSeconds = 300) {
  // Try cache first
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch from Supabase
  try {
    const data = await fetchFromSupabase();
    if (data !== null && data !== undefined) {
      // Cache the result (fire and forget)
      setCache(cacheKey, data, ttlSeconds).catch(err => {
        console.error(`[Cache] Failed to cache ${cacheKey}:`, err);
      });
    }
    return data;
  } catch (error) {
    console.error(`[Cache] Error in cacheFirst for ${cacheKey}:`, error);
    throw error;
  }
}

/**
 * Write-through pattern: Write to Supabase, then update cache
 * @param {Function} writeToSupabase - Async function that writes to Supabase
 * @param {string} cacheKey - Redis cache key to invalidate/update
 * @param {Function} updateCache - Optional function to update cache with new data
 * @returns {Promise<any>} - Result from Supabase write
 */
export async function writeThrough(writeToSupabase, cacheKey, updateCache = null) {
  // Write to Supabase first
  const result = await writeToSupabase();

  // Update or invalidate cache
  if (updateCache) {
    // Update cache with new data
    const cacheData = await updateCache(result);
    if (cacheData !== null && cacheData !== undefined) {
      setCache(cacheKey, cacheData).catch(err => {
        console.error(`[Cache] Failed to update cache ${cacheKey}:`, err);
      });
    }
  } else {
    // Invalidate cache
    deleteCache(cacheKey).catch(err => {
      console.error(`[Cache] Failed to invalidate cache ${cacheKey}:`, err);
    });
  }

  return result;
}




