import { createSupabaseAdminClient } from '../supabase/server-admin.js';

/**
 * Broadcast message to room via Supabase Realtime (messages table)
 * @param {string} roomId - Room ID
 * @param {object} message - Message to broadcast
 * @param {string|null} excludePlayerId - Player ID to exclude from broadcast (ignored - clients filter if needed)
 */
export async function broadcastToWebSocket(roomId, message, excludePlayerId = null) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Insert message into versus_messages table
    // Clients subscribe to INSERT events via Realtime
    const { error } = await supabase
      .from('versus_messages')
      .insert({
        room_id: roomId,
        message: message,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error(`[broadcast] Failed to broadcast to room ${roomId}:`, error);
    }
    
    // Note: excludePlayerId is ignored - clients filter if needed
    // Messages are cleaned up by cron job after processing
  } catch (error) {
    console.warn(`[broadcast] Could not broadcast:`, error.message);
  }
}

