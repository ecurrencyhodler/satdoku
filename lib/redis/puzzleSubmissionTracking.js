import { getGameState } from './gameState.js';
import crypto from 'crypto';

/**
 * Puzzle submission tracking utilities
 */

/**
 * Create a hash for a puzzle to track submissions
 * @param {string} sessionId - The session ID
 * @param {Array<Array<number>>} solution - The puzzle solution
 * @returns {string} Hash string
 */
function createPuzzleHash(sessionId, solution) {
  // Create a deterministic hash from sessionId + solution
  const solutionString = JSON.stringify(solution);
  const hash = crypto.createHash('sha256');
  hash.update(sessionId);
  hash.update(solutionString);
  return hash.digest('hex');
}

/**
 * Check if a puzzle has already been submitted to the leaderboard
 * @param {string} sessionId - The session ID
 * @param {Array<Array<number>>} solution - The puzzle solution
 * @returns {Promise<boolean>} True if already submitted
 */
export async function isPuzzleAlreadySubmitted(sessionId, solution) {
  const { getRedisClient } = await import('./client.js');
  const client = await getRedisClient();

  if (!client) {
    // If Redis unavailable, allow submission (fail open for availability)
    return false;
  }

  const puzzleHash = createPuzzleHash(sessionId, solution);
  const key = `leaderboard:submitted:${puzzleHash}`;

  const exists = await client.exists(key);
  return exists === 1;
}

/**
 * Mark a puzzle as submitted to prevent duplicate submissions
 * @param {string} sessionId - The session ID
 * @param {Array<Array<number>>} solution - The puzzle solution
 * @returns {Promise<void>}
 */
export async function markPuzzleAsSubmitted(sessionId, solution) {
  const { getRedisClient } = await import('./client.js');
  const client = await getRedisClient();

  if (!client) {
    return;
  }

  const puzzleHash = createPuzzleHash(sessionId, solution);
  const key = `leaderboard:submitted:${puzzleHash}`;

  // Store with 1 year expiration (same as game state)
  await client.setEx(key, 365 * 24 * 60 * 60, '1');
}

/**
 * Mark a puzzle as submitted after successful leaderboard entry
 * This should be called after addLeaderboardEntry succeeds
 * @param {string} sessionId - The session ID (optional)
 * @returns {Promise<void>}
 */
export async function markSubmissionAfterAdd(sessionId) {
  if (!sessionId) {
    return; // Can't mark without sessionId
  }

  try {
    const gameState = await getGameState(sessionId);
    if (gameState && gameState.currentSolution) {
      await markPuzzleAsSubmitted(sessionId, gameState.currentSolution);
    }
  } catch (error) {
    // Log error but don't fail - marking is best effort
    console.error('[puzzleSubmissionTracking] Error marking puzzle as submitted:', error);
  }
}






