/**
 * Broadcast message to WebSocket server
 * @param {string} roomId - Room ID
 * @param {object} message - Message to broadcast
 * @param {string|null} excludePlayerId - Player ID to exclude from broadcast
 */
export async function broadcastToWebSocket(roomId, message, excludePlayerId = null) {
  const wsUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001';
  
  try {
    const response = await fetch(`${wsUrl}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId,
        message,
        excludePlayerId
      })
    });

    if (!response.ok) {
      console.error(`[broadcast] Failed to broadcast to room ${roomId}:`, response.statusText);
    }
  } catch (error) {
    // WebSocket server might not be running - log but don't fail
    console.warn(`[broadcast] Could not broadcast to WebSocket server:`, error.message);
  }
}

