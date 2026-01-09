import { NextResponse } from 'next/server';
import { cleanupExpiredRooms } from '../../../../lib/supabase/versusRooms.js';

/**
 * POST /api/versus/cleanup - Manually trigger cleanup of expired rooms
 * This endpoint can be called manually or by a cron job
 */
export async function POST(request) {
  try {
    const result = await cleanupExpiredRooms();
    
    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      errors: result.errors
    });
  } catch (error) {
    console.error('[versus/cleanup] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/versus/cleanup - Get cleanup status (same as POST, for convenience)
 */
export async function GET(request) {
  return POST(request);
}
