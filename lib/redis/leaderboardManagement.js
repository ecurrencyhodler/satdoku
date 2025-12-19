import { getRedisClient } from './client.js';
import { getAllLeaderboardEntries } from './leaderboardCore.js';

/**
 * Leaderboard management operations (remove, clear)
 */

/**
 * Remove the last (lowest-scoring) entry from the leaderboard
 * Only considers entries with usernames (consistent with display logic)
 * @returns {Promise<{removed: boolean, entry?: object}>} Object indicating if an entry was removed and the removed entry if applicable
 */
export async function removeLastLeaderboardEntry() {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }

  const key = 'leaderboard:scores';

  // Get all entries sorted by score (ascending = lowest first)
  const allMembers = await client.zRange(key, 0, -1, { REV: false });

  if (!allMembers || allMembers.length === 0) {
    return { removed: false };
  }

  // Find the last (lowest-scoring) entry with a username
  // Since entries are sorted ascending (lowest first), we iterate from the beginning
  // to find the first entry with a username, which is the lowest-scoring entry with a username
  let memberToRemove = null;
  let removedEntry = null;

  for (const member of allMembers) {
    try {
      const data = JSON.parse(member);
      if (data.username && data.username.trim().length > 0) {
        memberToRemove = member;
        removedEntry = {
          sessionId: data.sessionId,
          username: data.username.trim(),
          score: data.score,
          completedAt: data.completedAt || data.timestamp || new Date().toISOString()
        };
        break;
      }
    } catch (error) {
      console.error('Error parsing leaderboard entry:', error);
    }
  }

  if (!memberToRemove) {
    return { removed: false };
  }

  // Remove the entry from the sorted set
  await client.zRem(key, memberToRemove);

  return { removed: true, entry: removedEntry };
}

/**
 * Remove leaderboard entries by username or sessionId
 * @param {string|Array<string>} identifiers - Username(s) or sessionId(s) to remove
 * @returns {Promise<{removed: number, entries: Array}>} Object with count of removed entries and their data
 */
export async function removeLeaderboardEntries(identifiers) {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }

  const key = 'leaderboard:scores';

  // Normalize identifiers to array
  const identifiersArray = Array.isArray(identifiers) ? identifiers : [identifiers];
  const identifiersSet = new Set(identifiersArray.map(id => id.toLowerCase()));

  // Get all entries
  const allMembers = await client.zRange(key, 0, -1, { REV: false });

  if (!allMembers || allMembers.length === 0) {
    return { removed: 0, entries: [] };
  }

  // Find entries to remove
  const entriesToRemove = [];
  const removedEntries = [];

  for (const member of allMembers) {
    try {
      const data = JSON.parse(member);
      const username = (data.username || '').toLowerCase();
      const sessionId = (data.sessionId || '').toLowerCase();

      // Check if this entry matches any identifier
      if (identifiersSet.has(username) || identifiersSet.has(sessionId)) {
        entriesToRemove.push(member);
        removedEntries.push({
          sessionId: data.sessionId,
          username: data.username || data.sessionId,
          score: data.score,
          completedAt: data.completedAt || data.timestamp || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error parsing leaderboard entry:', error);
    }
  }

  // Remove entries if any were found
  if (entriesToRemove.length > 0) {
    await client.zRem(key, entriesToRemove);
  }

  return {
    removed: entriesToRemove.length,
    entries: removedEntries
  };
}

/**
 * Clear the leaderboard, preserving the ecurrencyhodler entry if it exists
 * @returns {Promise<void>}
 */
export async function clearLeaderboard() {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }

  const key = 'leaderboard:scores';

  // Get all entries to find ecurrencyhodler
  const allEntries = await getAllLeaderboardEntries();
  const ecurrencyhodlerEntry = allEntries.find(entry =>
    entry.username && entry.username.toLowerCase() === 'ecurrencyhodler'
  );

  // Clear all entries
  await client.del(key);

  // If ecurrencyhodler entry was found, re-add it with the exact same Redis score
  if (ecurrencyhodlerEntry) {
    const entryData = ecurrencyhodlerEntry.rawData;
    const redisScore = ecurrencyhodlerEntry.redisScore;

    // Re-add the entry with the preserved Redis score
    await client.zAdd(key, [{
      score: redisScore,
      value: JSON.stringify(entryData)
    }]);
  }
}






