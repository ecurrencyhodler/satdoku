import { getRedisClient, resetRedisClient } from './client.js';

/**
 * Save a game completion to Redis
 * @param {object} completion - Completion object with completionId, sessionId, score, difficulty, mistakes, duration, completedAt, eligibleForLeaderboard, submittedToLeaderboard
 * @returns {Promise<boolean>} - Success status
 */
export async function saveCompletion(completion) {
  try {
    // Validate input parameters
    if (!completion || typeof completion !== 'object') {
      console.error('[Redis] Invalid completion object:', completion);
      return false;
    }
    
    if (!completion.completionId || typeof completion.completionId !== 'string') {
      console.error('[Redis] Invalid completionId:', completion.completionId);
      return false;
    }
    
    if (!completion.sessionId || typeof completion.sessionId !== 'string') {
      console.error('[Redis] Invalid sessionId for completion:', completion.sessionId);
      return false;
    }
    
    if (typeof completion.score !== 'number' || isNaN(completion.score) || completion.score < 0) {
      console.error('[Redis] Invalid score for completion:', completion.score);
      return false;
    }
    
    if (!completion.difficulty || typeof completion.difficulty !== 'string') {
      console.error('[Redis] Invalid difficulty for completion:', completion.difficulty);
      return false;
    }
    
    if (typeof completion.mistakes !== 'number' || isNaN(completion.mistakes) || completion.mistakes < 0) {
      console.error('[Redis] Invalid mistakes for completion:', completion.mistakes);
      return false;
    }
    
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot save completion - Redis not available');
      return false;
    }

    const completionId = completion.completionId;
    const hashKey = `completion:${completionId}`;
    const listKey = 'completions:list';
    const value = JSON.stringify(completion);
    
    // Store in hash map
    await redis.set(hashKey, value);
    await redis.expire(hashKey, 365 * 24 * 60 * 60); // 1 year
    
    // Also add to list for enumeration
    await redis.lPush(listKey, completionId);
    // Only set expiration if this is a new list
    const listLength = await redis.lLen(listKey);
    if (listLength === 1) {
      await redis.expire(listKey, 365 * 24 * 60 * 60);
    }
    
    console.log(`[Redis] Saved completion: ${completionId}, session: ${completion.sessionId}, score: ${completion.score}`);
    return true;
  } catch (error) {
    console.error('[Redis] Error saving completion:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}

/**
 * Get a completion by completionId
 * @param {string} completionId - The completion ID
 * @returns {Promise<object|null>} - Completion object or null if not found
 */
export async function getCompletion(completionId) {
  try {
    if (!completionId || typeof completionId !== 'string') {
      console.error('[Redis] Invalid completionId:', completionId);
      return null;
    }
    
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot get completion - Redis not available');
      return null;
    }

    const hashKey = `completion:${completionId}`;
    const value = await redis.get(hashKey);
    
    if (!value) {
      return null;
    }
    
    return JSON.parse(value);
  } catch (error) {
    console.error('[Redis] Error getting completion:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return null;
  }
}

/**
 * Validate completion for leaderboard submission
 * @param {string} completionId - The completion ID
 * @param {string} sessionId - The session ID to validate against
 * @returns {Promise<{valid: boolean, error?: string, completion?: object}>}
 */
export async function validateCompletionForLeaderboard(completionId, sessionId) {
  try {
    const completion = await getCompletion(completionId);
    
    if (!completion) {
      return {
        valid: false,
        error: 'Completion not found'
      };
    }
    
    if (completion.sessionId !== sessionId) {
      return {
        valid: false,
        error: 'Completion does not belong to this session'
      };
    }
    
    if (completion.eligibleForLeaderboard !== true) {
      return {
        valid: false,
        error: 'Completion is not eligible for leaderboard'
      };
    }
    
    if (completion.submittedToLeaderboard === true) {
      return {
        valid: false,
        error: 'Completion has already been submitted to leaderboard'
      };
    }
    
    return {
      valid: true,
      completion
    };
  } catch (error) {
    console.error('[Redis] Error validating completion:', error);
    return {
      valid: false,
      error: 'Error validating completion'
    };
  }
}

/**
 * Mark a completion as submitted to leaderboard
 * @param {string} completionId - The completion ID
 * @returns {Promise<boolean>} - Success status
 */
export async function markCompletionSubmitted(completionId) {
  try {
    const completion = await getCompletion(completionId);
    
    if (!completion) {
      console.error('[Redis] Cannot mark completion as submitted - completion not found:', completionId);
      return false;
    }
    
    completion.submittedToLeaderboard = true;
    
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot mark completion as submitted - Redis not available');
      return false;
    }

    const hashKey = `completion:${completionId}`;
    const value = JSON.stringify(completion);
    
    await redis.set(hashKey, value);
    // Preserve existing expiration
    await redis.expire(hashKey, 365 * 24 * 60 * 60);
    
    console.log(`[Redis] Marked completion as submitted: ${completionId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Error marking completion as submitted:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}



