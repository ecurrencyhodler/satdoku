import { WebSocketServer } from 'ws';
import http from 'http';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { getRoom, updateRoomState, cleanupAbandonedGames } from '../lib/redis/versusRooms.js';
import { getRedisClient } from '../lib/redis/client.js';
import { trackPuzzleStart } from '../lib/supabase/puzzleSessions.js';

// Load environment variables from .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env');

const result = config({ path: envPath });

const PORT = process.env.WS_PORT || 3001;
const server = http.createServer();
const wss = new WebSocketServer({ server });

// Verify Redis connection on startup
(async () => {
  try {
    const redis = await getRedisClient();
    if (redis) {
      console.log(`[WebSocket Server] Redis connected, URL: ${process.env.REDIS_URL || 'not set'}`);
    } else {
      console.error('[WebSocket Server] Redis not available!');
    }
  } catch (error) {
    console.error('[WebSocket Server] Redis connection error:', error);
  }
})();

// Handle server startup errors (e.g. port already in use) so we don't crash with an unhandled event
server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[WebSocket Server] Port ${PORT} is already in use. You probably already have a ws server running.`);
    console.error(`[WebSocket Server] Fix: stop the other process, OR set WS_PORT=3002 and NEXT_PUBLIC_WS_URL=ws://localhost:3002 then restart both servers.`);
    process.exit(1);
  }
});

// Store connections by room ID and player ID
const roomConnections = new Map(); // roomId -> Map(playerId -> WebSocket)
const connectionMetadata = new Map(); // WebSocket -> { roomId, playerId, sessionId }

/**
 * Broadcast message to all connections in a room
 */
function broadcastToRoom(roomId, message, excludePlayerId = null) {
  const connections = roomConnections.get(roomId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((ws, playerId) => {
    if (playerId !== excludePlayerId && ws.readyState === ws.OPEN) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error(`[WebSocket] Error sending to ${playerId} in room ${roomId}:`, error);
      }
    }
  });
}

/**
 * Add connection to room
 */
function addConnectionToRoom(roomId, playerId, ws, sessionId) {
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Map());
  }
  roomConnections.get(roomId).set(playerId, ws);
  connectionMetadata.set(ws, { roomId, playerId, sessionId });
}

/**
 * Remove connection from room
 */
function removeConnectionFromRoom(ws) {
  const metadata = connectionMetadata.get(ws);
  if (!metadata) return;

  const { roomId, playerId } = metadata;
  const connections = roomConnections.get(roomId);
  if (connections) {
    connections.delete(playerId);
    if (connections.size === 0) {
      roomConnections.delete(roomId);
    }
  }
  connectionMetadata.delete(ws);
}

/**
 * Update player connection status in room
 */
async function updatePlayerConnectionStatus(roomId, playerId, connected) {
  const room = await getRoom(roomId);
  if (!room || !room.players[playerId]) return;

  const updatedRoom = {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        ...room.players[playerId],
        connected,
        // Set lastDisconnectedAt when disconnecting, clear it when connecting
        lastDisconnectedAt: connected ? null : new Date().toISOString()
      }
    }
  };

  await updateRoomState(roomId, updatedRoom, room.version);
}

/**
 * Start countdown for a room
 */
async function startCountdown(roomId) {
  const room = await getRoom(roomId);
  if (!room) return;

  // Update room status to countdown
  const updatedRoom = {
    ...room,
    gameStatus: 'countdown',
    countdown: 3
  };
  await updateRoomState(roomId, updatedRoom, room.version);

  // Broadcast countdown start
  broadcastToRoom(roomId, {
    type: 'countdown_start',
    countdown: 3
  });

  // Countdown: 3, 2, 1, 0
  let countdown = 3;
  const countdownInterval = setInterval(async () => {
    countdown--;
    
    const currentRoom = await getRoom(roomId);
    if (!currentRoom) {
      clearInterval(countdownInterval);
      return;
    }

    // Check if both players are still connected
    const player1Connected = currentRoom.players.player1?.connected;
    const player2Connected = currentRoom.players.player2?.connected;

    if (!player1Connected || !player2Connected) {
      // Pause countdown if a player disconnected
      // If both disconnected, reset countdown
      if (!player1Connected && !player2Connected) {
        const resetRoom = {
          ...currentRoom,
          gameStatus: 'waiting',
          countdown: 0,
          players: {
            ...currentRoom.players,
            player1: {
              ...currentRoom.players.player1,
              ready: false
            },
            player2: {
              ...currentRoom.players.player2,
              ready: false
            }
          }
        };
        await updateRoomState(roomId, resetRoom, currentRoom.version);
        broadcastToRoom(roomId, {
          type: 'countdown_reset',
          reason: 'both_players_disconnected'
        });
      } else {
        // Only one disconnected - pause
        const pausedRoom = {
          ...currentRoom,
          gameStatus: 'waiting',
          countdown: 0
        };
        await updateRoomState(roomId, pausedRoom, currentRoom.version);
        broadcastToRoom(roomId, {
          type: 'countdown_paused',
          reason: 'player_disconnected'
        });
      }
      clearInterval(countdownInterval);
      return;
    }

    if (countdown > 0) {
      const countdownRoom = {
        ...currentRoom,
        countdown
      };
      await updateRoomState(roomId, countdownRoom, currentRoom.version);
      broadcastToRoom(roomId, {
        type: 'countdown',
        countdown
      });
    } else {
      // Start game
      const gameStartTime = new Date().toISOString();
      const startedRoom = {
        ...currentRoom,
        gameStatus: 'playing',
        countdown: 0,
        gameStartTime
      };
      await updateRoomState(roomId, startedRoom, currentRoom.version);
      broadcastToRoom(roomId, {
        type: 'game_start',
        gameStartTime
      });
      
      // Track puzzle start for both players (fire and forget)
      if (currentRoom.players.player1?.sessionId) {
        trackPuzzleStart(currentRoom.players.player1.sessionId, currentRoom.difficulty).catch(err => {
          console.error('[WebSocket] Failed to track puzzle start for player1:', err);
        });
      }
      if (currentRoom.players.player2?.sessionId) {
        trackPuzzleStart(currentRoom.players.player2.sessionId, currentRoom.difficulty).catch(err => {
          console.error('[WebSocket] Failed to track puzzle start for player2:', err);
        });
      }
      
      clearInterval(countdownInterval);
    }
  }, 1000);
}

// HTTP endpoint for API to trigger broadcasts
server.on('request', async (req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { roomId, message, excludePlayerId } = JSON.parse(body);
        
        // Handle special message types
        if (message.type === 'ready_check') {
          // Check if both players are ready and start countdown
          const room = await getRoom(roomId);
          if (room && 
              room.gameStatus === 'waiting' &&
              room.players.player1?.ready &&
              room.players.player2?.ready &&
              room.players.player1?.connected &&
              room.players.player2?.connected) {
            startCountdown(roomId);
          }
        } else {
          // Regular broadcast
          broadcastToRoom(roomId, message, excludePlayerId);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

wss.on('connection', async (ws, req) => {
  console.log('[WebSocket] New connection');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, roomId, playerId, sessionId } = message;

      if (type === 'join') {
        // Validate room and player - retry a few times in case of Redis propagation delay
        let room = await getRoom(roomId);
        let retries = 0;
        const maxRetries = 5;
        
        while (!room && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 300 * (retries + 1))); // Exponential backoff
          room = await getRoom(roomId);
          retries++;
        }
        
        if (!room) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Room not found'
          }));
          ws.close();
          return;
        }

        // Simple identification: player1 by sessionId match, otherwise assign as player2 if slot is available
        let actualPlayerId = null;
        
        if (room.players.player1?.sessionId === sessionId) {
          actualPlayerId = 'player1';
        } else {
          // If not player1, assign as player2 if player2 slot is not filled/connected
          // Simple logic: first person to join gets player2, spectators only if player2 is taken AND connected
          const player2Exists = !!room.players.player2;
          const player2IsConnected = room.players.player2?.connected === true;
          const player2SessionMatches = room.players.player2?.sessionId === sessionId;
          
          // Assign as player2 if: player2 doesn't exist, OR player2 exists but not connected, OR sessionId matches
          // Only make spectator if player2 exists, is connected, AND sessionId doesn't match
          if (!player2Exists || !player2IsConnected || player2SessionMatches) {
            actualPlayerId = 'player2';
            
            // Ensure player2 slot exists and has correct sessionId
            if (!room.players.player2) {
              // Create player2 slot
              room.players.player2 = {
                sessionId,
                name: 'Player 2',
                score: 0,
                lives: 2,
                mistakes: 0,
                ready: false,
                connected: false,
                selectedCell: null,
                notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []))
              };
              await updateRoomState(roomId, room, room.version);
            } else if (room.players.player2.sessionId !== sessionId) {
              // Update sessionId if it doesn't match (handles Redis propagation delay)
              room.players.player2.sessionId = sessionId;
              await updateRoomState(roomId, room, room.version);
            }
          } else {
            // Player2 exists, is connected, and has different sessionId - make spectator
            actualPlayerId = `spectator_${sessionId}`;
          }
        }

        // Add connection
        addConnectionToRoom(roomId, actualPlayerId, ws, sessionId);

        // Update connection status if player
        if (actualPlayerId === 'player1' || actualPlayerId === 'player2') {
          await updatePlayerConnectionStatus(roomId, actualPlayerId, true);
        }

        // Send current room state
        const currentRoom = await getRoom(roomId);
        ws.send(JSON.stringify({
          type: 'joined',
          roomId,
          playerId: actualPlayerId,
          room: currentRoom
        }));

        // Broadcast player joined (if player, not spectator)
        if (actualPlayerId === 'player1' || actualPlayerId === 'player2') {
          // Also send full room state update to all players in the room
          const updatedRoom = await getRoom(roomId);
          broadcastToRoom(roomId, {
            type: 'state_update',
            room: updatedRoom
          });
          broadcastToRoom(roomId, {
            type: 'player_connected',
            playerId: actualPlayerId
          }, actualPlayerId);
        }

        console.log(`[WebSocket] ${actualPlayerId} joined room ${roomId}`);
      } else if (type === 'ready_check') {
        // Check if both players are ready
        const room = await getRoom(roomId);
        if (room && 
            room.gameStatus === 'waiting' &&
            room.players.player1?.ready &&
            room.players.player2?.ready &&
            room.players.player1?.connected &&
            room.players.player2?.connected) {
          // Start countdown
          startCountdown(roomId);
        }
      } else if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  });

  ws.on('close', async () => {
    const metadata = connectionMetadata.get(ws);
    if (metadata) {
      const { roomId, playerId } = metadata;
      console.log(`[WebSocket] ${playerId} disconnected from room ${roomId}`);

      // Update connection status if player
      if (playerId === 'player1' || playerId === 'player2') {
        await updatePlayerConnectionStatus(roomId, playerId, false);

        // Broadcast player disconnected
        broadcastToRoom(roomId, {
          type: 'player_disconnected',
          playerId
        }, playerId);
      }

      removeConnectionFromRoom(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`[WebSocket] Server started on port ${PORT}`);
  
  // Run cleanup every 10 minutes
  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  setInterval(async () => {
    try {
      await cleanupAbandonedGames();
    } catch (error) {
      console.error('[WebSocket] Error in periodic cleanup:', error);
    }
  }, CLEANUP_INTERVAL_MS);
  
  // Run initial cleanup after 1 minute (to allow server to fully start)
  setTimeout(async () => {
    try {
      await cleanupAbandonedGames();
    } catch (error) {
      console.error('[WebSocket] Error in initial cleanup:', error);
    }
  }, 60 * 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WebSocket] SIGTERM received, closing server');
  wss.close(() => {
    server.close(() => {
      console.log('[WebSocket] Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('[WebSocket] SIGINT received, closing server');
  wss.close(() => {
    server.close(() => {
      console.log('[WebSocket] Server closed');
      process.exit(0);
    });
  });
});
