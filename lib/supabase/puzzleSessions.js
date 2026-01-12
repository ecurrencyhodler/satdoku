import { createSupabaseClient } from './client.js';
import { cacheFirst } from './cache.js';

/**
 * Track when a puzzle is started
 * @param {string} sessionId - Session ID
 * @param {string} difficulty - Difficulty level
 * @param {string|null} roomId - Optional room ID for versus puzzles (null for solo)
 * @returns {Promise<boolean>} - Success status
 */
export async function trackPuzzleStart(sessionId, difficulty, roomId = null) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for puzzle start:', sessionId);
      return false;
    }

    if (!difficulty || typeof difficulty !== 'string') {
      console.error('[Supabase] Invalid difficulty for puzzle start:', difficulty);
      return false;
    }

    const supabase = createSupabaseClient();

    const insertData = {
      session_id: sessionId,
      difficulty: difficulty,
      status: 'in_progress',
    };

    // Include room_id if provided (for versus puzzles)
    if (roomId) {
      insertData.room_id = roomId;
    }

    const { error } = await supabase
      .from('puzzle_sessions')
      .insert(insertData);

    if (error) {
      console.error('[Supabase] Error tracking puzzle start:', error);
      return false;
    }

    const gameType = roomId ? 'versus' : 'solo';
    console.log(`[Supabase] Tracked puzzle start: session ${sessionId}, difficulty ${difficulty}, type ${gameType}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error tracking puzzle start:', error);
    return false;
  }
}

/**
 * Track when a puzzle is completed
 * @param {string} sessionId - Session ID
 * @param {string} difficulty - Difficulty level (optional, for matching)
 * @param {string|null} roomId - Optional room ID for versus puzzles (null for solo)
 * @returns {Promise<boolean>} - Success status
 */
export async function trackPuzzleCompletion(sessionId, difficulty = null, roomId = null) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for puzzle completion:', sessionId);
      return false;
    }

    const supabase = createSupabaseClient();

    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    let query = supabase
      .from('puzzle_sessions')
      .update(updateData)
      .eq('session_id', sessionId)
      .eq('status', 'in_progress');

    // If difficulty provided, also match on difficulty
    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    // If roomId provided, match on room_id (for versus puzzles)
    // If roomId is null, match on room_id IS NULL (for solo puzzles)
    if (roomId !== null) {
      query = query.eq('room_id', roomId);
    } else {
      query = query.is('room_id', null);
    }

    const { error } = await query;

    if (error) {
      console.error('[Supabase] Error tracking puzzle completion:', error);
      return false;
    }

    const gameType = roomId ? 'versus' : 'solo';
    console.log(`[Supabase] Tracked puzzle completion: session ${sessionId}, type ${gameType}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error tracking puzzle completion:', error);
    return false;
  }
}

/**
 * Update mistakes count for a puzzle session
 * @param {string} sessionId - Session ID
 * @param {number} mistakes - Current mistakes count
 * @returns {Promise<boolean>} - Success status
 */
export async function updatePuzzleSessionMistakes(sessionId, mistakes) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for updating mistakes:', sessionId);
      return false;
    }

    if (typeof mistakes !== 'number' || isNaN(mistakes) || mistakes < 0) {
      console.error('[Supabase] Invalid mistakes count:', mistakes);
      return false;
    }

    const supabase = createSupabaseClient();

    // First, find the most recent in_progress session for this session_id
    const { data: sessions, error: findError } = await supabase
      .from('puzzle_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);

    if (findError) {
      console.error('[Supabase] Error finding puzzle session:', findError);
      return false;
    }

    if (!sessions || sessions.length === 0) {
      // No in_progress session found - this is okay, might be a completed game
      return true;
    }

    // Update only the most recent session
    const { error } = await supabase
      .from('puzzle_sessions')
      .update({ mistakes })
      .eq('id', sessions[0].id);

    if (error) {
      console.error('[Supabase] Error updating puzzle session mistakes:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Supabase] Error updating puzzle session mistakes:', error);
    return false;
  }
}

/**
 * Get total number of completed puzzles
 * @param {string} sessionId - Optional session ID to filter by
 * @returns {Promise<number>} - Total count
 */
export async function getTotalCompletedPuzzles(sessionId = null) {
  try {
    const cacheKey = sessionId
      ? `completions:stats:session:${sessionId}`
      : 'completions:stats:total';

    return await cacheFirst(
      cacheKey,
      async () => {
        const supabase = createSupabaseClient();

        let query = supabase
          .from('puzzle_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed');

        if (sessionId) {
          query = query.eq('session_id', sessionId);
        }

        const { count, error } = await query;

        if (error) {
          console.error('[Supabase] Error getting total completed puzzles:', error);
          return 0;
        }

        return count || 0;
      },
      15 * 60 // 15 minutes TTL
    );
  } catch (error) {
    console.error('[Supabase] Error getting total completed puzzles:', error);
    return 0;
  }
}








