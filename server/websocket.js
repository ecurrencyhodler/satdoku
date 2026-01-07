import { WebSocketServer } from 'ws';
import http from 'http';
import { getRoom, updateRoomState } from '../lib/redis/versusRooms.js';

const PORT = process.env.WS_PORT || 3001;
const server = http.createServer();
const wss = new WebSocketServer({ server });

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
        connected
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
        // Validate room and player
        const room = await getRoom(roomId);
        if (!room) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Room not found'
          }));
          ws.close();
          return;
        }

        // Determine if this is player1, player2, or spectator
        let actualPlayerId = null;
        if (room.players.player1?.sessionId === sessionId) {
          actualPlayerId = 'player1';
        } else if (room.players.player2?.sessionId === sessionId) {
          actualPlayerId = 'player2';
        } else {
          // Spectator
          actualPlayerId = `spectator_${sessionId}`;
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
