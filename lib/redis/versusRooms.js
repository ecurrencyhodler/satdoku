import { getRedisClient } from './client.js';

const ROOM_EXPIRATION = 12 * 60 * 60; // 12 hours in seconds
const ROOM_PREFIX = 'versus_room:';
const ROOM_VERSION_PREFIX = 'versus_room_version:';

/**
 * Generate a unique room ID
 */
function generateRoomId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `room_${timestamp}_${randomStr}`;
}

/**
 * Create a new versus room
 * @param {string} sessionId - Player 1's session ID
 * @param {string} difficulty - Difficulty level
 * @param {string} playerName - Player 1's name
 * @returns {Promise<{success: boolean, roomId?: string, error?: string}>}
 */
export async function createRoom(sessionId, difficulty, playerName) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    const roomId = generateRoomId();
    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const versionKey = `${ROOM_VERSION_PREFIX}${roomId}`;

    // Initialize room state
    const roomState = {
      roomId,
      difficulty,
      gameStatus: 'waiting',
      players: {
        player1: {
          sessionId,
          name: playerName || 'Player 1',
          score: 0,
          lives: 2,
          mistakes: 0,
          ready: false,
          connected: false,
          selectedCell: null,
          notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []))
        },
        player2: null
      },
      countdown: 0,
      winner: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      completedRows: [],
      completedColumns: [],
      completedBoxes: []
    };

    // Store room state with expiration (will be updated when game finishes)
    await redis.setEx(roomKey, ROOM_EXPIRATION, JSON.stringify(roomState));
    await redis.set(versionKey, '0');

    console.log(`[versusRooms] Created room ${roomId} for player ${sessionId}`);
    return { success: true, roomId };
  } catch (error) {
    console.error('[versusRooms] Error creating room:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Join a room as player 2
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player 2's session ID
 * @param {string} playerName - Player 2's name
 * @returns {Promise<{success: boolean, error?: string, isSpectator?: boolean}>}
 */
export async function joinRoom(roomId, sessionId, playerName) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const roomData = await redis.get(roomKey);

    if (!roomData) {
      return { success: false, error: 'Room not found' };
    }

    const room = JSON.parse(roomData);

    // Check if user is trying to join their own room
    if (room.players.player1?.sessionId === sessionId) {
      return { success: false, error: 'Cannot join your own room as player 2' };
    }

    // Check if room is full
    if (room.players.player2 && room.players.player2.sessionId !== sessionId) {
      // Room is full, allow as spectator
      return { success: true, isSpectator: true };
    }

    // Add player 2
    if (!room.players.player2) {
      room.players.player2 = {
        sessionId,
        name: playerName || 'Player 2',
        score: 0,
        lives: 2,
        mistakes: 0,
        ready: false,
        connected: false,
        selectedCell: null,
        notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []))
      };

      await redis.setEx(roomKey, ROOM_EXPIRATION, JSON.stringify(room));
    }

    return { success: true, isSpectator: false };
  } catch (error) {
    console.error('[versusRooms] Error joining room:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get room state
 * @param {string} roomId - Room ID
 * @returns {Promise<object|null>}
 */
export async function getRoom(roomId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return null;
    }

    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const versionKey = `${ROOM_VERSION_PREFIX}${roomId}`;

    const [roomData, version] = await Promise.all([
      redis.get(roomKey),
      redis.get(versionKey)
    ]);

    if (!roomData) {
      return null;
    }

    const room = JSON.parse(roomData);
    room.version = version ? parseInt(version, 10) : 0;
    return room;
  } catch (error) {
    console.error('[versusRooms] Error getting room:', error);
    return null;
  }
}

/**
 * Update room state with version control
 * @param {string} roomId - Room ID
 * @param {object} state - Updated state
 * @param {number|null} expectedVersion - Expected version for optimistic locking
 * @returns {Promise<{success: boolean, version?: number, conflict?: boolean}>}
 */
export async function updateRoomState(roomId, state, expectedVersion = null) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false };
    }

    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const versionKey = `${ROOM_VERSION_PREFIX}${roomId}`;

    // Get current version
    const currentVersionStr = await redis.get(versionKey);
    const currentVersion = currentVersionStr ? parseInt(currentVersionStr, 10) : 0;

    // Check version conflict
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      return {
        success: false,
        conflict: true,
        version: currentVersion
      };
    }

    // Increment version
    const newVersion = await redis.incr(versionKey);

    // Update room state
    // Always set expiration to 12 hours
    // When game finishes, the expiration starts from that moment (12 hours to view results)
    await redis.setEx(roomKey, ROOM_EXPIRATION, JSON.stringify(state));

    return { success: true, version: newVersion };
  } catch (error) {
    console.error('[versusRooms] Error updating room state:', error);
    return { success: false };
  }
}

/**
 * Set player ready status
 * @param {string} roomId - Room ID
 * @param {string} playerId - 'player1' or 'player2'
 * @param {boolean} ready - Ready status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setPlayerReady(roomId, playerId, ready) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    const room = await getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (!room.players[playerId]) {
      return { success: false, error: 'Player not found' };
    }

    room.players[playerId].ready = ready;
    const result = await updateRoomState(roomId, room, room.version);

    if (!result.success) {
      return { success: false, error: 'Failed to update ready status' };
    }

    return { success: true };
  } catch (error) {
    console.error('[versusRooms] Error setting player ready:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update player name
 * @param {string} roomId - Room ID
 * @param {string} playerId - 'player1' or 'player2'
 * @param {string} name - New name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePlayerName(roomId, playerId, name) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    const room = await getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Only allow name updates when game is waiting
    if (room.gameStatus !== 'waiting') {
      return { success: false, error: 'Cannot update name after game starts' };
    }

    if (!room.players[playerId]) {
      return { success: false, error: 'Player not found' };
    }

    room.players[playerId].name = name;
    const result = await updateRoomState(roomId, room, room.version);

    if (!result.success) {
      return { success: false, error: 'Failed to update name' };
    }

    return { success: true };
  } catch (error) {
    console.error('[versusRooms] Error updating player name:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add spectator to room
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Spectator's session ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function addSpectator(roomId, sessionId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    const room = await getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Room must have 2 players to allow spectators
    if (!room.players.player1 || !room.players.player2) {
      return { success: false, error: 'Room is not full' };
    }

    // Spectators are tracked separately (optional - for analytics)
    // For now, we just allow the connection
    return { success: true };
  } catch (error) {
    console.error('[versusRooms] Error adding spectator:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete room
 * @param {string} roomId - Room ID
 * @returns {Promise<boolean>}
 */
export async function deleteRoom(roomId) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }

    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const versionKey = `${ROOM_VERSION_PREFIX}${roomId}`;

    await Promise.all([
      redis.del(roomKey),
      redis.del(versionKey)
    ]);

    console.log(`[versusRooms] Deleted room ${roomId}`);
    return true;
  } catch (error) {
    console.error('[versusRooms] Error deleting room:', error);
    return false;
  }
}

