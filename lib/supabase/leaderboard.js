import { getRedisClient } from '../redis/client.js';
import { createSupabaseClient } from './client.js';

const LEADERBOARD_KEY = 'leaderboard:scores';

/**
 * Get top 10 leaderboard entries
 * Reads from Redis (source of truth), falls back to Supabase if Redis unavailable
 * @returns {Promise<Array>} Array of {sessionId, username, score, completedAt} sorted by score (highest first)
 */
export async function getLeaderboard() {
  try {
    const client = await getRedisClient();

    if (client) {
      // Read from Redis (source of truth)
      const members = await client.zRange(LEADERBOARD_KEY, 0, 9, { REV: true });

      if (members && members.length > 0) {
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
    }

    // Redis unavailable or empty - fallback to Supabase
    console.warn('[Leaderboard] Redis unavailable, falling back to Supabase');
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('session_id, username, score, completed_at')
      .not('username', 'is', null)
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Leaderboard] Error fetching from Supabase:', error);
      return [];
    }

    return (data || []).map(entry => ({
      sessionId: entry.session_id,
      username: entry.username,
      score: entry.score,
      completedAt: entry.completed_at
    }));
  } catch (error) {
    console.error('[Leaderboard] Error getting leaderboard:', error);
    return [];
  }
}

/**
 * Check if a score qualifies for the top 10 leaderboard
 * Uses Redis sorted set for fast computation
 * @param {number} score - The score to check
 * @returns {Promise<boolean>} - True if score qualifies
 */
export async function checkScoreQualifies(score) {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    // Get all entries and filter to only those with usernames
    const allMembers = await client.zRange(LEADERBOARD_KEY, 0, -1, { REV: true });
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

    // If less than 10 entries with usernames, any score qualifies
    if (count < 10) {
      return true;
    }

    // Get the 10th highest entry with username
    if (entriesWithUsernames.length < 10) {
      return true;
    }

    const lowestEntry = entriesWithUsernames[9];
    const lowestScore = lowestEntry.score;

    // Score qualifies only if it's strictly greater than the lowest score
    return score > lowestScore;
  } catch (error) {
    console.error('[Leaderboard] Error checking score qualification:', error);
    return false;
  }
}

/**
 * Add a leaderboard entry
 * Computes rank in Redis first, then persists to Supabase
 * @param {string} sessionId - The session ID
 * @param {number} score - The game score
 * @param {string} [username] - Optional username to display
 * @returns {Promise<Array>} The updated leaderboard
 * @throws {Error} If score doesn't qualify
 */
export async function addLeaderboardEntry(sessionId, score, username) {
  // Validate input parameters
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required and must be a string');
  }

  if (typeof score !== 'number' || isNaN(score) || score < 0) {
    throw new Error('score must be a non-negative number');
  }

  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }

  // Remove any existing entries with the same sessionId that don't have a username
  const membersToCheck = await client.zRange(LEADERBOARD_KEY, 0, -1, { REV: false });
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
    await client.zRem(LEADERBOARD_KEY, entriesToRemove);
  }

  // Check if score qualifies before adding
  const qualifies = await checkScoreQualifies(score);
  if (!qualifies) {
    throw new Error('Score does not qualify for leaderboard (must be greater than lowest score)');
  }

  // Create entry data with timestamp
  const now = new Date();
  const timestamp = now.getTime();
  const entryData = {
    sessionId: sessionId,
    score: score,
    completedAt: now.toISOString(),
    _timestamp: timestamp
  };

  // Add username if provided
  if (username && typeof username === 'string' && username.trim().length > 0) {
    entryData.username = username.trim();
  }

  // Calculate timestamp adjustment for ranking (same logic as Redis implementation)
  const minTimestamp = new Date('2000-01-01').getTime();
  const maxTimestamp = new Date('2100-01-01').getTime();
  const normalizedTimestamp = (timestamp - minTimestamp) / (maxTimestamp - minTimestamp);
  const timestampAdjustment = -normalizedTimestamp * 0.0000001;
  const adjustedScore = score + timestampAdjustment;

  // Add to Redis sorted set (compute rank)
  await client.zAdd(LEADERBOARD_KEY, [{
    score: adjustedScore,
    value: JSON.stringify(entryData)
  }]);

  // Get current rank from Redis
  const rank = await client.zRevRank(LEADERBOARD_KEY, JSON.stringify(entryData));
  const currentRank = rank !== null ? rank + 1 : null; // 1-based rank

  // Remove entries beyond top 10 (only considering entries with usernames)
  const allMembersAfterAdd = await client.zRange(LEADERBOARD_KEY, 0, -1, { REV: true });
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
  const membersToRemove = allMembersAfterAdd.filter(m => !top10Set.has(m));

  if (membersToRemove.length > 0) {
    await client.zRem(LEADERBOARD_KEY, membersToRemove);
  }

  // Persist to Supabase (fire and forget)
  // Note: Redis is the source of truth for leaderboard. Supabase is for persistence/backup.
  // If this fails, the entry is still in Redis and can be recovered.
  // For production, consider using a queue system for reliable persistence.
  const supabase = createSupabaseClient();
  supabase
    .from('leaderboard_entries')
    .insert({
      session_id: sessionId,
      username: username ? username.trim() : null,
      score: score,
      completed_at: now.toISOString(),
      rank: currentRank,
      redis_score: adjustedScore
    })
    .then(({ error }) => {
      if (error) {
        // Log with more context for debugging
        console.error('[Leaderboard] Error persisting to Supabase:', {
          error,
          sessionId,
          score,
          rank: currentRank
        });
        // In production, you might want to send this to an error tracking service
      } else {
        console.log(`[Leaderboard] Persisted entry to Supabase: ${sessionId}, score: ${score}, rank: ${currentRank}`);
      }
    })
    .catch(err => {
      console.error('[Leaderboard] Error persisting to Supabase (exception):', {
        error: err,
        sessionId,
        score,
        rank: currentRank
      });
    });

  // Return updated leaderboard
  return await getLeaderboard();
}

/**
 * Get all leaderboard entries (not just top 10) with their Redis scores
 * @returns {Promise<Array>} Array of all entries {sessionId, username, score, completedAt, rawData, redisScore}
 */
export async function getAllLeaderboardEntries() {
  try {
    const client = await getRedisClient();
    if (!client) {
      // Fallback to Supabase
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .order('score', { ascending: false });

      if (error) {
        console.error('[Leaderboard] Error fetching all entries from Supabase:', error);
        return [];
      }

      return (data || []).map(entry => ({
        sessionId: entry.session_id,
        username: entry.username || entry.session_id,
        score: entry.score,
        completedAt: entry.completed_at,
        rawData: entry,
        redisScore: entry.redis_score
      }));
    }

    const key = LEADERBOARD_KEY;
    const membersWithScores = await client.zRangeWithScores(key, 0, -1, { REV: true });

    if (!membersWithScores || membersWithScores.length === 0) {
      return [];
    }

    const leaderboard = [];
    for (const item of membersWithScores) {
      try {
        const data = JSON.parse(item.value);
        const entry = {
          sessionId: data.sessionId,
          username: data.username || data.sessionId,
          score: data.score,
          completedAt: data.completedAt || data.timestamp || new Date().toISOString(),
          rawData: data,
          redisScore: item.score
        };
        leaderboard.push(entry);
      } catch (error) {
        console.error('Error parsing leaderboard entry:', error);
      }
    }

    return leaderboard;
  } catch (error) {
    console.error('[Leaderboard] Error getting all leaderboard entries:', error);
    return [];
  }
}



