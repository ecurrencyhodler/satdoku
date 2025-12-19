import { getRedisClient } from './client.js';

/**
 * Core leaderboard operations (get, add, check)
 */

/**
 * Get top 10 leaderboard entries
 * @returns {Promise<Array>} Array of {sessionId, username, score, completedAt} sorted by score (highest first)
 */
export async function getLeaderboard() {
  const client = await getRedisClient();
  if (!client) {
    return [];
  }

  const key = 'leaderboard:scores';

  // Get top 10 entries (sorted set, descending by score)
  const members = await client.zRange(key, 0, 9, { REV: true });

  if (!members || members.length === 0) {
    return [];
  }

  // Parse entries and get scores
  // Filter out entries without usernames - they should not be displayed
  const leaderboard = [];
  for (const member of members) {
    try {
      const data = JSON.parse(member);
      // Only include entries that have a username
      if (data.username && data.username.trim().length > 0) {
        leaderboard.push({
          sessionId: data.sessionId,
          username: data.username.trim(),
          score: data.score,
          completedAt: data.completedAt || data.timestamp || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error parsing leaderboard entry:', error);
    }
  }

  return leaderboard;
}

/**
 * Check if a score qualifies for the top 10 leaderboard
 * Returns true if leaderboard has < 10 entries with usernames OR score > lowest score
 * Returns false if score equals the lowest score (when leaderboard is full)
 * Note: Scores matching existing entries are allowed (existing entries will rank higher)
 * Only entries with usernames are considered for qualification
 */
export async function checkScoreQualifies(score) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  const key = 'leaderboard:scores';

  // Get all entries and filter to only those with usernames
  const allMembers = await client.zRange(key, 0, -1, { REV: true });
  const entriesWithUsernames = [];
  for (const member of allMembers) {
    try {
      const data = JSON.parse(member);
      if (data.username && data.username.trim().length > 0) {
        entriesWithUsernames.push(data);
      }
    } catch (e) {
      // Skip invalid entries
    }
  }

  const count = entriesWithUsernames.length;

  // If less than 10 entries with usernames, any score qualifies (even if it matches existing entries)
  if (count < 10) {
    return true;
  }

  // Get the 10th highest entry with username (index 9, 0-based)
  if (entriesWithUsernames.length < 10) {
    return true;
  }

  const lowestEntry = entriesWithUsernames[9];
  const lowestScore = lowestEntry.score;

  // Score qualifies only if it's strictly greater than the lowest score
  // If it equals the lowest score, it doesn't qualify (existing entry is preferred)
  // If it's greater, it qualifies even if it matches other existing entries
  return score > lowestScore;
}

/**
 * Add a leaderboard entry and maintain top 10
 * @param {string} sessionId - The session ID
 * @param {number} score - The game score
 * @param {string} [username] - Optional username to display
 * @returns {Promise<Array>} The updated leaderboard
 * @throws {Error} If score doesn't qualify
 *
 * Note: Entries with matching scores are allowed. Existing entries will rank higher
 * because they have earlier timestamps, which results in a smaller negative adjustment
 * to their Redis score, making them rank higher than new entries with the same base score.
 */
export async function addLeaderboardEntry(sessionId, score, username) {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }

  // Validate input parameters
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required and must be a string');
  }

  if (typeof score !== 'number' || isNaN(score) || score < 0) {
    throw new Error('score must be a non-negative number');
  }

  const key = 'leaderboard:scores';

  // Remove any existing entries with the same sessionId that don't have a username
  // This handles the case where /api/completions adds an entry without username,
  // and then /api/leaderboard adds another with username
  // Only remove entries without username to prevent two entries from the same submission
  const membersToCheck = await client.zRange(key, 0, -1, { REV: false });
  const entriesToRemove = [];
  for (const member of membersToCheck) {
    try {
      const data = JSON.parse(member);
      if (data.sessionId === sessionId && (!data.username || data.username.trim().length === 0)) {
        entriesToRemove.push(member);
      }
    } catch (e) {
      // Skip invalid entries
    }
  }

  if (entriesToRemove.length > 0) {
    await client.zRem(key, entriesToRemove);
  }

  // Check if score qualifies before adding
  const qualifies = await checkScoreQualifies(score);
  if (!qualifies) {
    throw new Error('Score does not qualify for leaderboard (must be greater than lowest score)');
  }

  // Create entry data with timestamp
  // The timestamp is used to calculate a score adjustment that ensures older entries
  // rank higher than newer entries when they have the same base score
  const now = new Date();
  const timestamp = now.getTime();
  const entryData = {
    sessionId: sessionId,
    score: score,
    completedAt: now.toISOString(),
    _timestamp: timestamp // Internal field for ordering
  };

  // Add username if provided
  if (username && typeof username === 'string' && username.trim().length > 0) {
    entryData.username = username.trim();
  }

  // For Redis sorted sets, when scores are equal, members are ordered lexicographically.
  // To ensure existing entries rank higher than new entries with the same score,
  // we use a very small negative adjustment to the Redis score based on timestamp.
  // Older entries get a smaller (less negative) adjustment, making them rank higher.

  // Calculate a tiny negative adjustment: newer entries get more negative adjustment
  // This ensures entries with the same base score are ordered: older entries first (higher rank)
  // We use fixed reference timestamps for consistent normalization
  const minTimestamp = new Date('2000-01-01').getTime();
  const maxTimestamp = new Date('2100-01-01').getTime();
  // Normalize timestamp to 0-1 range (0 = year 2000, 1 = year 2100)
  // This gives us a consistent scale regardless of when the code runs
  const normalizedTimestamp = (timestamp - minTimestamp) / (maxTimestamp - minTimestamp);
  // Apply negative adjustment: newer entries get more negative, so they rank lower
  // The adjustment is very small (0.0000001) so it doesn't affect score comparisons
  // For entries from year 2000: adjustment ≈ 0 (ranks highest)
  // For entries from year 2100: adjustment ≈ -0.0000001 (ranks lowest)
  const timestampAdjustment = -normalizedTimestamp * 0.0000001;
  const adjustedScore = score + timestampAdjustment;

  // Add to sorted set with adjusted score
  // This ensures entries with the same base score are ordered by timestamp (older = higher rank)
  await client.zAdd(key, [{
    score: adjustedScore,
    value: JSON.stringify(entryData)
  }]);

  // Remove entries beyond top 10 (only considering entries with usernames)
  // Get all entries sorted by score (descending = highest first)
  const allMembersAfterAdd = await client.zRange(key, 0, -1, { REV: true });

  // Filter to only entries with usernames and keep top 10
  const entriesWithUsernames = [];
  for (const member of allMembersAfterAdd) {
    try {
      const data = JSON.parse(member);
      if (data.username && data.username.trim().length > 0) {
        entriesWithUsernames.push(member);
      }
    } catch (e) {
      // Skip invalid entries
    }
  }

  // Keep top 10 entries with usernames
  const top10WithUsernames = entriesWithUsernames.slice(0, 10);
  const top10Set = new Set(top10WithUsernames);

  // Remove all entries not in top 10 (including entries without usernames)
  const membersToRemove = allMembersAfterAdd.filter(m => !top10Set.has(m));

  if (membersToRemove.length > 0) {
    await client.zRem(key, membersToRemove);
  }

  // Return updated leaderboard
  return await getLeaderboard();
}

/**
 * Get all leaderboard entries (not just top 10) with their Redis scores
 * @returns {Promise<Array>} Array of all entries {sessionId, username, score, completedAt, rawData, redisScore}
 */
export async function getAllLeaderboardEntries() {
  const client = await getRedisClient();
  if (!client) {
    return [];
  }

  const key = 'leaderboard:scores';

  // Get all entries with scores (sorted set, descending by score)
  const membersWithScores = await client.zRangeWithScores(key, 0, -1, { REV: true });

  if (!membersWithScores || membersWithScores.length === 0) {
    return [];
  }

  // Parse entries
  const leaderboard = [];
  for (const item of membersWithScores) {
    try {
      const data = JSON.parse(item.value);
      const entry = {
        sessionId: data.sessionId,
        username: data.username || data.sessionId,
        score: data.score,
        completedAt: data.completedAt || data.timestamp || new Date().toISOString(),
        rawData: data, // Keep raw data for preserving entry
        redisScore: item.score // Preserve the exact Redis score
      };
      leaderboard.push(entry);
    } catch (error) {
      console.error('Error parsing leaderboard entry:', error);
    }
  }

  return leaderboard;
}






