import { getRedisClient, resetRedisClient } from './client.js';

/**
 * Save a game completion to Redis
 * @param {string} sessionId - The session ID
 * @param {number} score - The final score
 * @param {string} difficulty - The game difficulty
 * @param {number} mistakes - The number of mistakes
 * @returns {Promise<boolean>} - Success status
 */
export async function saveCompletion(sessionId, score, difficulty, mistakes) {
  try {
    // Validate input parameters
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Redis] Invalid sessionId for completion:', sessionId);
      return false;
    }
    
    if (typeof score !== 'number' || isNaN(score) || score < 0) {
      console.error('[Redis] Invalid score for completion:', score);
      return false;
    }
    
    if (!difficulty || typeof difficulty !== 'string') {
      console.error('[Redis] Invalid difficulty for completion:', difficulty);
      return false;
    }
    
    if (typeof mistakes !== 'number' || isNaN(mistakes) || mistakes < 0) {
      console.error('[Redis] Invalid mistakes for completion:', mistakes);
      return false;
    }
    
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot save completion - Redis not available');
      return false;
    }

    const completion = {
      sessionId,
      score,
      difficulty,
      mistakes,
      completedAt: new Date().toISOString(),
    };

    const key = 'completions';
    const value = JSON.stringify(completion);
    
    // Append to list of completions
    const listLength = await redis.lPush(key, value);
    
    // Only set expiration if this is a new list (length is 1)
    // This prevents resetting the expiration timer on every save
    if (listLength === 1) {
      // Set expiration on the list (keep completions for 1 year)
      await redis.expire(key, 365 * 24 * 60 * 60);
    }
    
    console.log(`[Redis] Saved completion for session: ${sessionId}, score: ${score}, difficulty: ${difficulty}, mistakes: ${mistakes}`);
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
