import { createSupabaseClient } from './client.js';
import { cacheFirst } from './cache.js';

/**
 * Track when a puzzle is started
 * @param {string} sessionId - Session ID
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<boolean>} - Success status
 */
export async function trackPuzzleStart(sessionId, difficulty) {
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

    const { error } = await supabase
      .from('puzzle_sessions')
      .insert({
        session_id: sessionId,
        difficulty: difficulty,
        status: 'in_progress',
      });

    if (error) {
      console.error('[Supabase] Error tracking puzzle start:', error);
      return false;
    }

    console.log(`[Supabase] Tracked puzzle start: session ${sessionId}, difficulty ${difficulty}`);
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
 * @returns {Promise<boolean>} - Success status
 */
export async function trackPuzzleCompletion(sessionId, difficulty = null) {
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

    const { error } = await query;

    if (error) {
      console.error('[Supabase] Error tracking puzzle completion:', error);
      return false;
    }

    console.log(`[Supabase] Tracked puzzle completion: session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error tracking puzzle completion:', error);
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




