import { NextResponse } from 'next/server';
import { cleanupExpiredRooms } from '../../../../lib/supabase/versusRooms.js';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server-admin.js';

/**
 * Cron job to clean up expired versus rooms and old messages
 * Can be called via Vercel Cron or manually
 */
export async function GET(request) {
  try {
    // Clean up expired rooms
    const roomsResult = await cleanupExpiredRooms();
    
    // Clean up old messages (older than 1 hour)
    const supabase = createSupabaseAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error: messagesError, count: messagesCount } = await supabase
      .from('versus_messages')
      .delete()
      .lt('created_at', oneHourAgo)
      .select('*', { count: 'exact', head: true });
    
    if (messagesError) {
      console.error('[cleanup-versus-rooms] Error cleaning up messages:', messagesError);
    }
    
    return NextResponse.json({
      success: true,
      rooms: {
        deleted: roomsResult.deleted,
        errors: roomsResult.errors
      },
      messages: {
        deleted: messagesCount || 0,
        errors: messagesError ? 1 : 0
      }
    });
  } catch (error) {
    console.error('[cleanup-versus-rooms] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
