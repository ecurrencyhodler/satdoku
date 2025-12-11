import { createClient } from 'redis';

let client;
let clientPromise;

/**
 * Get or create Redis client
 * Uses singleton pattern for Next.js serverless functions
 * Ensures client is connected before returning
 */
async function getRedisClient() {
  if (client && client.isOpen) {
    return client;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not set, Redis operations will be disabled');
    return null;
  }

  // Reset if client exists but is not open
  if (client && !client.isOpen) {
    client = null;
    clientPromise = null;
  }

  if (!clientPromise) {
    client = createClient({
      url: redisUrl,
    });

    client.on('error', (err) => {
      console.error('[Redis] Client error:', err);
      // Reset on critical errors
      if (err.message?.includes('Connection') || err.message?.includes('ECONNREFUSED')) {
        client = null;
        clientPromise = null;
      }
    });

    client.on('connect', () => {
      console.log('[Redis] Client connected');
    });

    client.on('reconnecting', () => {
      console.log('[Redis] Client reconnecting');
    });

    client.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    try {
      clientPromise = client.connect();
      await clientPromise;
      
      // Verify client is ready after connection
      if (!client || !client.isOpen) {
        console.error('[Redis] Client not ready after connection');
        client = null;
        clientPromise = null;
        return null;
      }
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      client = null;
      clientPromise = null;
      return null;
    }
  } else {
    // Wait for existing connection promise
    try {
      await clientPromise;
      // Verify client is still open after awaiting
      if (!client || !client.isOpen) {
        client = null;
        clientPromise = null;
        return null;
      }
    } catch (error) {
      console.error('[Redis] Connection promise failed:', error);
      client = null;
      clientPromise = null;
      return null;
    }
  }

  return client;
}

/**
 * Lua script for atomic version check and increment
 * Returns: [success, newVersion] where success is 1 if version matches or expectedVersion is null, 0 otherwise
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
    // Syntax: eval(script, numKeys, ...keys, ...args)
    // Ensure all arguments are strings or integers as required by Redis client
    const expectedVersionStr = (expectedVersion != null && expectedVersion !== undefined) 
      ? String(expectedVersion) 
      : '';
    
    const result = await redis.eval(
      STORE_STATE_SCRIPT,
      2, // number of keys
      versionKey,
      key,
      expectedVersionStr,
      stateValue,
      expiration // Pass as integer, not string - Redis accepts integers and Lua uses tonumber()
    );
    
    const [success, newVersion] = result;
    
    if (success === 1) {
      // Update gameState with the new version before returning
      const stateWithVersion = { ...gameState, version: newVersion };
      console.log(`[Redis] Stored game state for session: ${sessionId}, version: ${newVersion}`);
      return { success: true, version: newVersion };
    } else {
      // Version conflict
      console.warn(`[Redis] Version conflict for session ${sessionId}: expected ${expectedVersion}, got ${newVersion}`);
      return { success: false, conflict: true };
    }
  } catch (error) {
    console.error('[Redis] Error storing game state:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      client = null;
      clientPromise = null;
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

    const parsed = JSON.parse(value);
    
    // Get version from separate version key (source of truth)
    // Fallback to parsed.version for backward compatibility
    const versionFromKey = versionValue ? parseInt(versionValue, 10) : null;
    parsed.version = versionFromKey !== null ? versionFromKey : (parsed.version ?? 0);
    
    return parsed;
  } catch (error) {
    console.error('[Redis] Error getting game state:', error);
    // Reset client on connection errors
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      client = null;
      clientPromise = null;
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
    return false;
  }
}

export default getRedisClient;

