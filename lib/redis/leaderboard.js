import { getRedisClient } from './client.js';

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
  const leaderboard = [];
  for (const member of members) {
    try {
      const data = JSON.parse(member);
      leaderboard.push({
        sessionId: data.sessionId,
        username: data.username || data.sessionId, // Fallback to sessionId for old entries
        score: data.score,
        completedAt: data.completedAt || data.timestamp || new Date().toISOString()
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
 * Returns false if score equals the lowest score (when leaderboard is full)
 * Note: Scores matching existing entries are allowed (existing entries will rank higher)
 */
export async function checkScoreQualifies(score) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  const key = 'leaderboard:scores';
  
  const count = await client.zCard(key);
  
  // If less than 10 entries, any score qualifies (even if it matches existing entries)
  if (count < 10) {
    return true;
  }
  
  // Get the 10th highest entry (index 9, 0-based)
  const members = await client.zRange(key, 9, 9, { REV: true });
  
  if (!members || members.length === 0) {
    return true;
  }
  
  // Parse the member to get the score
  try {
    const data = JSON.parse(members[0]);
    const lowestScore = data.score;
    
    // Score qualifies only if it's strictly greater than the lowest score
    // If it equals the lowest score, it doesn't qualify (existing entry is preferred)
    // If it's greater, it qualifies even if it matches other existing entries
    return score > lowestScore;
  } catch (error) {
    console.error('Error parsing leaderboard entry for qualification check:', error);
    return true; // If we can't parse, allow it
  }
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/redis/leaderboard.js:95',message:'addLeaderboardEntry called',data:{sessionId,score,username:username||null,hasUsername:!!username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
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
  
  // #region agent log
  const membersBefore = await client.zRange(key, 0, -1, { REV: false });
  const entriesBefore = [];
  for (const member of membersBefore) {
    try {
      const data = JSON.parse(member);
      entriesBefore.push({ sessionId: data.sessionId, username: data.username || null });
    } catch (e) {}
  }
  const existingEntryForSession = entriesBefore.find(e => e.sessionId === sessionId);
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/redis/leaderboard.js:112',message:'Checking for existing entry before adding',data:{sessionId,score,username:username||null,existingEntryFound:!!existingEntryForSession,existingEntryUsername:existingEntryForSession?.username||null,totalEntries:entriesBefore.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/redis/leaderboard.js:157',message:'About to add entry to Redis',data:{sessionId,score,username:username||null,entryData,adjustedScore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  // Add to sorted set with adjusted score
  // This ensures entries with the same base score are ordered by timestamp (older = higher rank)
  await client.zAdd(key, [{
    score: adjustedScore,
    value: JSON.stringify(entryData)
  }]);
  // #region agent log
  const membersAfter = await client.zRange(key, 0, -1, { REV: false });
  const entriesAfter = [];
  for (const member of membersAfter) {
    try {
      const data = JSON.parse(member);
      entriesAfter.push({ sessionId: data.sessionId, username: data.username || null });
    } catch (e) {}
  }
  const entriesForSession = entriesAfter.filter(e => e.sessionId === sessionId);
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/redis/leaderboard.js:162',message:'After adding entry to Redis',data:{sessionId,score,username:username||null,entriesForThisSession:entriesForSession.length,entriesForSessionUsernames:entriesForSession.map(e=>e.username),totalEntries:entriesAfter.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  // Remove entries beyond top 10
  // Get all entries sorted by score (ascending = lowest first)
  const countAfterAdd = await client.zCard(key);
  if (countAfterAdd > 10) {
    // Get top 10 (highest scores) - these are the last 10 in ascending order
    const top10Members = await client.zRange(key, countAfterAdd - 10, -1, { REV: false });
    const allMembersAfterAdd = await client.zRange(key, 0, -1, { REV: false });
    
    // Find members to remove (all members not in top 10)
    const top10Set = new Set(top10Members);
    const membersToRemove = allMembersAfterAdd.filter(m => !top10Set.has(m));
    
    if (membersToRemove.length > 0) {
      await client.zRem(key, membersToRemove);
    }
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

/**
 * Remove the last (lowest-scoring) entry from the leaderboard
 * @returns {Promise<{removed: boolean, entry?: object}>} Object indicating if an entry was removed and the removed entry if applicable
 */
export async function removeLastLeaderboardEntry() {
  const client = await getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }
  
  const key = 'leaderboard:scores';
  
  // Get the count of entries
  const count = await client.zCard(key);
  
  if (count === 0) {
    return { removed: false };
  }
  
  // Get the last entry (lowest score) - first entry in ascending order
  const members = await client.zRange(key, 0, 0, { REV: false });
  
  if (!members || members.length === 0) {
    return { removed: false };
  }
  
  const memberToRemove = members[0];
  
  // Parse the entry to return its data
  let removedEntry = null;
  try {
    const data = JSON.parse(memberToRemove);
    removedEntry = {
      sessionId: data.sessionId,
      username: data.username || data.sessionId,
      score: data.score,
      completedAt: data.completedAt || data.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error parsing leaderboard entry before removal:', error);
  }
  
  // Remove the entry from the sorted set
  await client.zRem(key, memberToRemove);
  
  return { removed: true, entry: removedEntry };
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
