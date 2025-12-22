import { getRedisClient, resetRedisClient } from './client.js';

/**
 * Lua script for atomic version check and increment
 * Returns: [success, newVersion] where success is 1 if version matches, 0 otherwise
 * If expectedVersion is null/empty, it still checks current version and returns it to prevent race conditions
 */
const STORE_STATE_SCRIPT = `
  local versionKey = KEYS[1]
  local stateKey = KEYS[2]
  local expectedVersionStr = ARGV[1]
  local stateValue = ARGV[2]
  local expiration = tonumber(ARGV[3])

  local currentVersion = redis.call('GET', versionKey)
  local currentVersionNum = currentVersion and tonumber(currentVersion) or 0

  -- If expectedVersion is provided (not empty string), check it matches
  if expectedVersionStr ~= '' and expectedVersionStr ~= nil then
    local expectedVersionNum = tonumber(expectedVersionStr)
    if expectedVersionNum == nil or currentVersionNum ~= expectedVersionNum then
      return {0, currentVersionNum}
    end
  else
    -- If no expectedVersion provided, we still need to prevent race conditions
    -- Return current version so caller knows what version was used
    -- This allows caller to decide if they want to proceed or retry
    -- For now, we'll allow it but return the current version for transparency
  end

  -- Atomically increment version
  local newVersion = redis.call('INCR', versionKey)

  -- Set expiration on first increment
  if newVersion == 1 then
    redis.call('EXPIRE', versionKey, expiration)
  end

  -- Store game state with expiration
  redis.call('SETEX', stateKey, expiration, stateValue)

  return {1, newVersion}
`;

/**
 * Store game state in Redis with optimistic locking (atomic version check)
 * @param {string} sessionId - The session ID
 * @param {object} gameState - Game state data
 * @param {number} expectedVersion - Optional version number for optimistic locking (null to skip check)
 * @returns {Promise<{success: boolean, version?: number, conflict?: boolean}>} - Result with version
 */
export async function storeGameState(sessionId, gameState, expectedVersion = null) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot store game state - Redis not available');
      return { success: false };
    }

    const key = `game_state:${sessionId}`;
    const versionKey = `game_state_version:${sessionId}`;
    const expiration = 90 * 24 * 60 * 60; // 90 days

    // Prepare state value with metadata
    const stateValue = JSON.stringify({
      ...gameState,
      storedAt: new Date().toISOString(),
    });

    // Use Lua script for atomic version check and increment
    // Redis v5 uses options object syntax: eval(script, { keys: [...], arguments: [...] })
    const expectedVersionStr = (expectedVersion != null && expectedVersion !== undefined)
      ? String(expectedVersion)
      : '';

    const result = await redis.eval(
      STORE_STATE_SCRIPT,
      {
        keys: [versionKey, key],
        arguments: [
          expectedVersionStr,
          stateValue,
          expiration.toString() // All arguments must be strings in Redis v5
        ]
      }
    );

    // Validate result format - should be [success, version]
    if (!Array.isArray(result) || result.length !== 2) {
      console.error(`[Redis] Unexpected Lua script result format:`, result);
      return { success: false };
    }

    const [success, version] = result;

    // Validate success is a number (0 or 1)
    if (typeof success !== 'number' || (success !== 0 && success !== 1)) {
      console.error(`[Redis] Unexpected success value from Lua script:`, success);
      return { success: false };
    }

    // Validate version is a number
    if (typeof version !== 'number') {
      console.error(`[Redis] Unexpected version value from Lua script:`, version);
      return { success: false };
    }

    if (success === 1) {
      // Success: version is the new incremented version
      console.log(`[Redis] Stored game state for session: ${sessionId}, version: ${version}`);
      return { success: true, version: version };
    } else {
      // Version conflict: version is the current version in Redis
      console.warn(`[Redis] Version conflict for session ${sessionId}: expected ${expectedVersion}, current version is ${version}`);
      return { success: false, conflict: true, version: version };
    }
  } catch (error) {
    console.error('[Redis] Error storing game state:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return { success: false };
  }
}

/**
 * Get game state from Redis
 * @param {string} sessionId - The session ID
 * @returns {Promise<object|null>} - Game state data or null if not found
 */
export async function getGameState(sessionId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot get game state - Redis not available');
      return null;
    }

    const key = `game_state:${sessionId}`;
    const versionKey = `game_state_version:${sessionId}`;

    // Get both state and version using Promise.all (automatic pipelining in Redis v5)
    const [value, versionValue] = await Promise.all([
      redis.get(key),
      redis.get(versionKey)
    ]);

    if (!value) {
      return null;
    }

    // Parse JSON with error handling to prevent crashes from corrupted data
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (parseError) {
      console.error(`[Redis] Failed to parse game state JSON for session ${sessionId}:`, parseError);
      // Optionally delete corrupted state to allow fresh start
      // For now, just return null so caller can handle gracefully
      return null;
    }

    // Get version from separate version key (source of truth)
    // Fallback to parsed.version for backward compatibility
    const versionFromKey = versionValue ? parseInt(versionValue, 10) : null;
    parsed.version = versionFromKey !== null ? versionFromKey : (parsed.version ?? 0);

    return parsed;
  } catch (error) {
    console.error('[Redis] Error getting game state:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return null;
  }
}

/**
 * Delete game state from Redis
 * @param {string} sessionId - The session ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteGameState(sessionId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[Redis] Cannot delete game state - Redis not available');
      return false;
    }

    const key = `game_state:${sessionId}`;
    const versionKey = `game_state_version:${sessionId}`;

    // Delete both state and version keys using Promise.all (automatic pipelining in Redis v5)
    await Promise.all([
      redis.del(key),
      redis.del(versionKey)
    ]);

    console.log(`[Redis] Deleted game state and version for session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Error deleting game state:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return false;
  }
}














