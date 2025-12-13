// Re-export all Redis functions for backward compatibility
// New code should import directly from specific modules:
// - lib/redis/client.js
// - lib/redis/gameState.js
// - lib/redis/completions.js
// - lib/redis/leaderboard.js

import { getRedisClient } from './redis/client.js';

export { getRedisClient, resetRedisClient } from './redis/client.js';
export { storeGameState, getGameState, deleteGameState } from './redis/gameState.js';
export { saveCompletion } from './redis/completions.js';
export { getLeaderboard, checkScoreQualifies, addLeaderboardEntry, removeLastLeaderboardEntry } from './redis/leaderboard.js';

// Default export for backward compatibility
export { default } from './redis/client.js';

/**
 * Set a key-value pair with optional expiration (in seconds)
 */
export async function set(key, value, options = {}) {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }
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
  if (!client) {
    return null;
  }
  const value = await client.get(key);
  return value ? (isNaN(value) ? value : Number(value)) : null;
}

/**
 * Delete a key
 */
export async function del(key) {
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  await client.del(key);
}

