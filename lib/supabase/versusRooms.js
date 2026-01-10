import { createSupabaseAdminClient } from './server-admin.js';
import { createVersusGameState } from '../game/versusGameState.js';
import { appendFileSync } from 'fs';

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
    const supabase = createSupabaseAdminClient();
    
    // Generate puzzle BEFORE calling RPC (required by plan)
    const gameState = await createVersusGameState(difficulty);
    
    // Generate room ID
    const roomId = generateRoomId();
    
    // Build room_state JSONB
    const roomState = {
      players: {
        player1: {
          sessionId,
          name: playerName || 'Player 1',
          score: 0,
          lives: 2,
          mistakes: 0,
          ready: false,
          selectedCell: null,
          notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []))
        },
        player2: null
      },
      countdown: 0,
      winner: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      finishedAt: null
    };
    
    // Build board_data JSONB
    const boardData = {
      current_board: gameState.currentBoard,
      current_puzzle: gameState.currentPuzzle,
      current_solution: gameState.currentSolution,
      completed_rows: gameState.completedRows || [],
      completed_columns: gameState.completedColumns || [],
      completed_boxes: gameState.completedBoxes || []
    };
    
    // Call RPC function to create room and board atomically
    const { error } = await supabase.rpc('create_versus_room', {
      p_room_id: roomId,
      p_difficulty: difficulty,
      p_room_state: roomState,
      p_board_data: boardData
    });
    
    if (error) {
      console.error('[versusRooms] Error creating room:', error);
      return { success: false, error: error.message };
    }
    
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
    const supabase = createSupabaseAdminClient();
    
    // Get room
    const room = await getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    // Check if user is trying to join their own room
    if (room.players.player1?.sessionId === sessionId) {
      return { success: false, error: 'Cannot join your own room as player 2' };
    }
    
    // Check if room is full
    if (room.players.player2 && room.players.player2.sessionId !== sessionId) {
      // Room is full, allow as spectator
      return { success: true, isSpectator: true };
    }
    
    // Add player 2 if doesn't exist
    if (!room.players.player2) {
      room.players.player2 = {
        sessionId,
        name: playerName || 'Player 2',
        score: 0,
        lives: 2,
        mistakes: 0,
        ready: false,
        selectedCell: null,
        notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []))
      };
      
      // Update room state
      const result = await updateRoomState(roomId, room, room.version);
      if (!result.success) {
        return { success: false, error: 'Failed to join room' };
      }
    }
    
    return { success: true, isSpectator: false };
  } catch (error) {
    console.error('[versusRooms] Error joining room:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get room state (joins rooms and boards tables)
 * @param {string} roomId - Room ID
 * @returns {Promise<object|null>}
 */
export async function getRoom(roomId) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Query room first
    const { data: roomData, error: roomError } = await supabase
      .from('versus_rooms')
      .select('*')
      .eq('room_id', roomId)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (roomError || !roomData) {
      return null;
    }
    
    // Query board data separately
    const { data: boardData, error: boardError } = await supabase
      .from('versus_room_boards')
      .select('*')
      .eq('room_id', roomId)
      .single();
    
    // Room exists, board might not (shouldn't happen, but handle gracefully)
    const board = boardData;
    
    return {
      roomId: roomData.room_id,
      version: roomData.version,
      difficulty: roomData.difficulty,
      status: roomData.status, // was gameStatus
      start_at: roomData.start_at ? new Date(roomData.start_at).toISOString() : null, // was gameStartTime
      winner: roomData.winner,
      createdAt: roomData.created_at,
      updatedAt: roomData.updated_at,
      expiresAt: roomData.expires_at,
      // Board data (from joined table)
      currentBoard: board?.current_board || null,
      currentPuzzle: board?.current_puzzle || null,
      currentSolution: board?.current_solution || null,
      completedRows: board?.completed_rows || [],
      completedColumns: board?.completed_columns || [],
      completedBoxes: board?.completed_boxes || [],
      // Aliases for compatibility
      board: board?.current_board || null,
      puzzle: board?.current_puzzle || null,
      solution: board?.current_solution || null,
      // Room state (from JSONB)
      players: roomData.room_state?.players || { player1: null, player2: null },
      countdown: roomData.room_state?.countdown || 0,
      completedAt: roomData.room_state?.completedAt || null,
      finishedAt: roomData.room_state?.finishedAt || null
    };
  } catch (error) {
    console.error('[versusRooms] Error getting room:', error);
    return null;
  }
}

/**
 * Update room state with version control (metadata-only updates)
 * @param {string} roomId - Room ID
 * @param {object} updatedRoom - Full room object (matches Redis pattern)
 * @param {number|null} expectedVersion - Expected version for optimistic locking
 * @returns {Promise<{success: boolean, version?: number, conflict?: boolean, error?: string}>}
 */
export async function updateRoomState(roomId, updatedRoom, expectedVersion = null) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // First, get current room to check version and build update
    const currentRoom = await getRoom(roomId);
    if (!currentRoom) {
      return { success: false, error: 'Room not found' };
    }
    
    // Check version conflict
    if (expectedVersion !== null && currentRoom.version !== expectedVersion) {
      return {
        success: false,
        conflict: true,
        version: currentRoom.version,
        error: 'Version conflict'
      };
    }
    
    // Build update object
    const updateData = {
      room_state: {
        players: updatedRoom.players,
        countdown: updatedRoom.countdown || 0,
        winner: updatedRoom.winner || null,
        completedAt: updatedRoom.completedAt || null,
        finishedAt: updatedRoom.finishedAt || null,
        createdAt: updatedRoom.createdAt || updatedRoom.created_at
      },
      updated_at: new Date().toISOString()
    };
    
    // Add top-level fields if present
    if (updatedRoom.status !== undefined) {
      updateData.status = updatedRoom.status;
    }
    if (updatedRoom.winner !== undefined) {
      updateData.winner = updatedRoom.winner;
    }
    if (updatedRoom.start_at !== undefined) {
      updateData.start_at = updatedRoom.start_at ? new Date(updatedRoom.start_at).toISOString() : null;
    }
    if (updatedRoom.expires_at !== undefined) {
      updateData.expires_at = updatedRoom.expires_at ? new Date(updatedRoom.expires_at).toISOString() : null;
    }
    
    // Use RPC or direct SQL to increment version atomically
    // For now, use a workaround: update with version check, then verify
    const { data, error } = await supabase
      .from('versus_rooms')
      .update({
        ...updateData,
        version: currentRoom.version + 1
      })
      .eq('room_id', roomId)
      .eq('version', currentRoom.version)
      .select('version')
      .single();
    
    if (error) {
      // Check if it's a version conflict (no rows updated)
      if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('0 rows')) {
        // Get current version
        const currentRoom = await getRoom(roomId);
        return {
          success: false,
          conflict: true,
          version: currentRoom?.version || null,
          error: 'Version conflict'
        };
      }
      console.error('[versusRooms] Error updating room state:', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      // No rows updated - version conflict
      const currentRoom = await getRoom(roomId);
      return {
        success: false,
        conflict: true,
        version: currentRoom?.version || null,
        error: 'Version conflict'
      };
    }
    
    return { success: true, version: data.version };
  } catch (error) {
    console.error('[versusRooms] Error updating room state:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply move (transactional board + metadata update via RPC)
 * @param {string} roomId - Room ID
 * @param {number} expectedVersion - Expected version
 * @param {object} boardData - Board data updates
 * @param {object} roomStateUpdates - Room state updates
 * @returns {Promise<{success: boolean, version?: number, error?: string, errorCode?: string, conflict?: boolean}>}
 */
export async function applyMove(roomId, expectedVersion, boardData, roomStateUpdates) {
  try {
    const supabase = createSupabaseAdminClient();
    
    const { data, error } = await supabase.rpc('apply_versus_move', {
      p_room_id: roomId,
      p_expected_version: expectedVersion,
      p_board_data: boardData,
      p_room_state_updates: roomStateUpdates
    });
    
    if (error) {
      // Parse error message to determine error type
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('VERSION_CONFLICT') || errorMessage.includes('version conflict')) {
        return {
          success: false,
          conflict: true,
          error: 'Version conflict',
          errorCode: 'VERSION_CONFLICT'
        };
      }
      
      if (errorMessage.includes('GAME_NOT_STARTED') || errorMessage.includes('game not started')) {
        return {
          success: false,
          error: 'Game has not started',
          errorCode: 'GAME_NOT_STARTED'
        };
      }
      
      if (errorMessage.includes('ROOM_NOT_FOUND') || errorMessage.includes('does not exist')) {
        return {
          success: false,
          error: 'Room not found',
          errorCode: 'ROOM_NOT_FOUND'
        };
      }
      
      return { success: false, error: errorMessage };
    }
    
    return { success: true, version: data?.p_new_version || null };
  } catch (error) {
    console.error('[versusRooms] Error applying move:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate game has started
 * @param {object} room - Room object
 * @returns {Promise<{valid: boolean, error?: string, errorCode?: string}>}
 */
export async function validateGameStarted(room) {
  if (!room.start_at) {
    return {
      valid: false,
      error: 'Game has not started',
      errorCode: 'GAME_NOT_STARTED'
    };
  }
  
  const startAt = new Date(room.start_at).getTime();
  const now = Date.now();
  
  if (now < startAt) {
    return {
      valid: false,
      error: 'Game has not started yet',
      errorCode: 'GAME_NOT_STARTED'
    };
  }
  
  return { valid: true };
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
    const room = await getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    // Only allow name updates when game is waiting
    if (room.status !== 'waiting') {
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
    
    // Broadcast state_update to notify other players (they will fetch full state from Postgres)
    const { broadcastToWebSocket } = await import('../../websocket/broadcast.js');
    broadcastToWebSocket(roomId, {
      type: 'state_update'
    });
    
    return { success: true };
  } catch (error) {
    console.error('[versusRooms] Error updating player name:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update player connection status
 * @param {string} roomId - Room ID
 * @param {string} playerId - 'player1' or 'player2'
 * @param {boolean} connected - Connection status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePlayerConnectionStatus(roomId, playerId, connected) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const room = await getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      
      if (!room.players[playerId]) {
        return { success: false, error: 'Player not found' };
      }
      
      // Check if connection status actually needs to change
      const currentConnected = room.players[playerId].connected;
      // #region agent log
      const logPath = '/Users/andrewyang/code/satdoku/.cursor/debug.log';
      const logEntry = JSON.stringify({location:'versusRooms.js:481',message:'updatePlayerConnectionStatus: checking current status',data:{roomId,playerId,currentConnected,requestedConnected:connected,needsChange:currentConnected!==connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
      appendFileSync(logPath, logEntry);
      // #endregion
      if (currentConnected === connected) {
        return { success: true };
      }
      
      room.players[playerId].connected = connected;
      // Set lastDisconnectedAt when disconnecting, clear it when connecting
      room.players[playerId].lastDisconnectedAt = connected ? null : new Date().toISOString();
      
      // #region agent log
      const logEntry2 = JSON.stringify({location:'versusRooms.js:490',message:'updatePlayerConnectionStatus: calling updateRoomState',data:{roomId,playerId,connected,version:room.version},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
      appendFileSync(logPath, logEntry2);
      // #endregion
      const result = await updateRoomState(roomId, room, room.version);
      
      // #region agent log
      const logEntry3 = JSON.stringify({location:'versusRooms.js:492',message:'updatePlayerConnectionStatus: updateRoomState result',data:{success:result.success,conflict:result.conflict,roomId,playerId,connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
      appendFileSync(logPath, logEntry3);
      // #endregion
      
      if (result.success) {
        return { success: true };
      }
      
      // If version conflict, retry with exponential backoff
      if (result.conflict && retryCount < maxRetries - 1) {
        retryCount++;
        const delay = Math.min(50 * Math.pow(2, retryCount - 1), 200); // 50ms, 100ms, 200ms max
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Retry with fresh room state
      }
      
      // If not a conflict or max retries reached, return error
      return { success: false, error: 'Failed to update connection status' };
    } catch (error) {
      console.error('[versusRooms] Error updating player connection status:', error);
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'Failed to update connection status after retries' };
}

/**
 * Add spectator to room
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Spectator's session ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function addSpectator(roomId, sessionId) {
  try {
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
    const supabase = createSupabaseAdminClient();
    
    const { error } = await supabase
      .from('versus_rooms')
      .delete()
      .eq('room_id', roomId);
    
    if (error) {
      console.error('[versusRooms] Error deleting room:', error);
      return false;
    }
    
    console.log(`[versusRooms] Deleted room ${roomId}`);
    return true;
  } catch (error) {
    console.error('[versusRooms] Error deleting room:', error);
    return false;
  }
}

/**
 * Atomically set start_at for a room (only if it's NULL)
 * @param {string} roomId - Room ID
 * @returns {Promise<{success: boolean, set: boolean, start_at?: string, error?: string}>}
 */
export async function setStartAtIfNull(roomId) {
  try {
    const supabase = createSupabaseAdminClient();
    
    const { data, error } = await supabase.rpc('set_versus_start_at', {
      p_room_id: roomId
    });
    
    if (error) {
      console.error('[versusRooms] Error setting start_at:', error);
      return { success: false, error: error.message };
    }
    
    // RPC returns OUT parameters directly, not nested
    const start_at = data?.p_start_at ? new Date(data.p_start_at).toISOString() : null;
    
    if (data?.p_set && start_at) {
      // start_at was successfully set by RPC
    }
    
    return {
      success: true,
      set: data?.p_set || false,
      start_at
    };
  } catch (error) {
    console.error('[versusRooms] Error setting start_at:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up expired rooms
 * @returns {Promise<{deleted: number, errors: number}>}
 */
export async function cleanupExpiredRooms() {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Delete expired rooms (boards cascade automatically)
    const { error, count } = await supabase
      .from('versus_rooms')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('[versusRooms] Error cleaning up expired rooms:', error);
      return { deleted: 0, errors: 1 };
    }
    
    const deleted = count || 0;
    
    if (deleted > 0) {
      console.log(`[versusRooms] Cleaned up ${deleted} expired rooms`);
    }
    
    return { deleted, errors: 0 };
  } catch (error) {
    console.error('[versusRooms] Error during cleanup:', error);
    return { deleted: 0, errors: 1 };
  }
}
