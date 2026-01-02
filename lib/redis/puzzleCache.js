import { getRedisClient, resetRedisClient } from './client.js';

const CACHE_PREFIX = 'puzzle_cache';
const CACHE_COUNT_KEY = 'puzzle_cache_count';
const TARGET_CACHE_SIZE = 100;
const REFILL_THRESHOLD = 80;
const REFILL_AMOUNT = 20;

/**
 * Get a cached puzzle for a given difficulty
 * @param {string} difficulty - Difficulty level (beginner, medium, hard)
 * @returns {Promise<{puzzle: number[][], solution: number[][]}|null>} - Cached puzzle or null
 */
export async function getCachedPuzzle(difficulty) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[PuzzleCache] Cannot get cached puzzle - Redis not available');
      return null;
    }

    const listKey = `${CACHE_PREFIX}:${difficulty}`;
    
    // Pop a puzzle from the list (atomic operation)
    const puzzleData = await redis.lPop(listKey);
    
    if (!puzzleData) {
      return null;
    }

    // Decrement count
    const countKey = `${CACHE_COUNT_KEY}:${difficulty}`;
    await redis.decr(countKey);

    try {
      const puzzle = JSON.parse(puzzleData);
      return puzzle;
    } catch (parseError) {
      console.error(`[PuzzleCache] Failed to parse cached puzzle for ${difficulty}:`, parseError);
      return null;
    }
  } catch (error) {
    console.error('[PuzzleCache] Error getting cached puzzle:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return null;
  }
}

/**
 * Add a puzzle to the cache
 * @param {string} difficulty - Difficulty level
 * @param {object} puzzleData - Puzzle data with puzzle and solution arrays
 * @returns {Promise<boolean>} - Success status
 */
export async function addCachedPuzzle(difficulty, puzzleData) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[PuzzleCache] Cannot add cached puzzle - Redis not available');
      return false;
    }

    const listKey = `${CACHE_PREFIX}:${difficulty}`;
    const countKey = `${CACHE_COUNT_KEY}:${difficulty}`;
    
    // Push puzzle to list and increment count atomically
    const puzzleJson = JSON.stringify(puzzleData);
    await Promise.all([
      redis.rPush(listKey, puzzleJson),
      redis.incr(countKey)
    ]);

    // Set expiration (30 days) on first puzzle
    const count = await redis.get(countKey);
    if (count === '1') {
      await Promise.all([
        redis.expire(listKey, 30 * 24 * 60 * 60),
        redis.expire(countKey, 30 * 24 * 60 * 60)
      ]);
    }

    return true;
  } catch (error) {
    console.error('[PuzzleCache] Error adding cached puzzle:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}

/**
 * Get the current cache count for a difficulty
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<number>} - Current cache count
 */
export async function getCacheCount(difficulty) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return 0;
    }

    const countKey = `${CACHE_COUNT_KEY}:${difficulty}`;
    const count = await redis.get(countKey);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('[PuzzleCache] Error getting cache count:', error);
    return 0;
  }
}

/**
 * Check if cache needs refilling (below threshold)
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<boolean>} - True if cache needs refilling
 */
export async function needsRefill(difficulty) {
  const count = await getCacheCount(difficulty);
  return count < REFILL_THRESHOLD;
}

/**
 * Get all cache counts for monitoring
 * @returns {Promise<object>} - Object with counts per difficulty
 */
export async function getAllCacheCounts() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { beginner: 0, medium: 0, hard: 0 };
    }

    const difficulties = ['beginner', 'medium', 'hard'];
    const counts = await Promise.all(
      difficulties.map(diff => getCacheCount(diff))
    );

    return {
      beginner: counts[0],
      medium: counts[1],
      hard: counts[2]
    };
  } catch (error) {
    console.error('[PuzzleCache] Error getting all cache counts:', error);
    return { beginner: 0, medium: 0, hard: 0 };
  }
}

/**
 * Add multiple puzzles to cache in batch
 * @param {string} difficulty - Difficulty level
 * @param {Array<object>} puzzles - Array of puzzle data objects
 * @returns {Promise<number>} - Number of puzzles successfully added
 */
export async function addCachedPuzzlesBatch(difficulty, puzzles) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[PuzzleCache] Cannot add cached puzzles - Redis not available');
      return 0;
    }

    const listKey = `${CACHE_PREFIX}:${difficulty}`;
    const countKey = `${CACHE_COUNT_KEY}:${difficulty}`;
    
    // Convert puzzles to JSON strings
    const puzzleStrings = puzzles.map(p => JSON.stringify(p));
    
    // Add all puzzles to list
    if (puzzleStrings.length > 0) {
      await redis.rPush(listKey, puzzleStrings);
      
      // Update count
      const currentCount = await getCacheCount(difficulty);
      await redis.set(countKey, currentCount + puzzleStrings.length);
      
      // Set expiration if this is the first batch
      if (currentCount === 0) {
        await Promise.all([
          redis.expire(listKey, 30 * 24 * 60 * 60),
          redis.expire(countKey, 30 * 24 * 60 * 60)
        ]);
      }
    }

    return puzzleStrings.length;
  } catch (error) {
    console.error('[PuzzleCache] Error adding cached puzzles batch:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return 0;
  }
}

export const CACHE_CONFIG = {
  TARGET_CACHE_SIZE,
  REFILL_THRESHOLD,
  REFILL_AMOUNT
};







