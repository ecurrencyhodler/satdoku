import { updatePlayerConnectionStatus } from '../../../../lib/supabase/versusRooms.js';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getRoom } from '../../../../lib/supabase/versusRooms.js';
import { appendFileSync } from 'fs';

export async function POST(request) {
  try {
    const { roomId, playerId, connected } = await request.json();
    
    if (!roomId || !playerId) {
      return Response.json(
        { success: false, error: 'Missing roomId or playerId' },
        { status: 400 }
      );
    }
    
    // Validate that the playerId is valid
    if (playerId !== 'player1' && playerId !== 'player2') {
      return Response.json(
        { success: false, error: 'Invalid playerId' },
        { status: 400 }
      );
    }
    
    // Verify the room exists
    const room = await getRoom(roomId);
    if (!room) {
      return Response.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    
    // #region agent log
    const logPath = '/Users/andrewyang/code/satdoku/.cursor/debug.log';
    const logEntry = JSON.stringify({location:'route.js:33',message:'connection API called',data:{roomId,playerId,connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
    appendFileSync(logPath, logEntry);
    // #endregion
    
    // Update connection status
    const result = await updatePlayerConnectionStatus(roomId, playerId, connected);
    
    // #region agent log
    const logEntry2 = JSON.stringify({location:'route.js:40',message:'connection API result',data:{success:result.success,error:result.error,roomId,playerId,connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
    appendFileSync(logPath, logEntry2);
    // #endregion
    
    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating connection status:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
