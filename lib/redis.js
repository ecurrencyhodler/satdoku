// Re-export all Redis functions for backward compatibility
// New code should import directly from specific modules:
// - lib/redis/client.js
// - lib/redis/gameState.js
// - lib/redis/completions.js

import { getRedisClient } from './redis/client.js';

export { getRedisClient, resetRedisClient } from './redis/client.js';
export { storeGameState, getGameState, deleteGameState } from './redis/gameState.js';
export { saveCompletion } from './redis/completions.js';

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

/**
 * Get top 10 leaderboard entries
 * Returns array of {username, score, mistakes, timestamp} sorted by score (highest first)
 */
export async function getLeaderboard() {
  const client = await getRedisClient();
  if (!client) {
    return [];
  }
  const key = 'leaderboard:scores';
  
  // Get top 10 entries (sorted set, descending by score)
  // zRevRange returns members, then we get scores separately
  const members = await client.zRevRange(key, 0, 9);
  
  if (!members || members.length === 0) {
    return [];
  }
  
  // Parse entries and get scores
  const leaderboard = [];
  for (const member of members) {
    try {
      const data = JSON.parse(member);
      // The score stored in Redis is the game score
      // We can get it from the data object or from Redis
      leaderboard.push({
        username: data.username,
        score: data.score,
        mistakes: data.mistakes,
        timestamp: data.timestamp || Date.now()
      });
    } catch (error) {
      console.error('Error parsing leaderboard entry:', error);
    }
  }
  
  return leaderboard;
}

/**
 * Check if a score qualifies for the top 10 leaderboard
 * Returns true if leaderboard has < 10 entries OR score > lowest score
 */
export async function checkScoreQualifies(score) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  const key = 'leaderboard:scores';
  
  const count = await client.zCard(key);
  
  // If less than 10 entries, any score qualifies
  if (count < 10) {
    return true;
  }
  
  // Get the 10th highest entry (index 9, 0-based)
  const members = await client.zRevRange(key, 9, 9);
  
  if (!members || members.length === 0) {
    return true;
  }
  
  // Parse the member to get the score
  try {
    const data = JSON.parse(members[0]);
    const lowestScore = data.score;
    
    // Score qualifies if it's greater than the lowest score
    return score > lowestScore;
  } catch (error) {
    console.error('Error parsing leaderboard entry for qualification check:', error);
    return true; // If we can't parse, allow it
  }
}

/**
 * Add a leaderboard entry and maintain top 10
 * Returns the updated leaderboard
 */
export async function addLeaderboardEntry(username, score, mistakes) {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }
  const key = 'leaderboard:scores';
  
  // Create entry data
  const entryData = {
    username: username.trim(),
    score: score,
    mistakes: mistakes,
    timestamp: Date.now()
  };
  
  // Add to sorted set (score is the Redis score, JSON is the member)
  await client.zAdd(key, [{
    score: score,
    value: JSON.stringify(entryData)
  }]);
  
  // Remove entries beyond top 10 (keep indices 0-9, remove 10 onwards)
  await client.zRemRangeByRank(key, 10, -1);
  
  // Return updated leaderboard
  return await getLeaderboard();
}
