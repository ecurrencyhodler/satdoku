import { createSupabaseClient } from './client.js';
import { cacheFirst } from './cache.js';

/**
 * Save a game completion to Supabase (with Redis cache)
 * @param {object} completion - Completion object
 * @returns {Promise<boolean>} - Success status
 */
export async function saveCompletion(completion) {
  try {
    // Validate input parameters
    if (!completion || typeof completion !== 'object') {
      console.error('[Supabase] Invalid completion object:', completion);
      return false;
    }

    if (!completion.completionId || typeof completion.completionId !== 'string') {
      console.error('[Supabase] Invalid completionId:', completion.completionId);
      return false;
    }

    if (!completion.sessionId || typeof completion.sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for completion:', completion.sessionId);
      return false;
    }

    if (typeof completion.score !== 'number' || isNaN(completion.score) || completion.score < 0) {
      console.error('[Supabase] Invalid score for completion:', completion.score);
      return false;
    }

    if (!completion.difficulty || typeof completion.difficulty !== 'string') {
      console.error('[Supabase] Invalid difficulty for completion:', completion.difficulty);
      return false;
    }

    if (typeof completion.mistakes !== 'number' || isNaN(completion.mistakes) || completion.mistakes < 0) {
      console.error('[Supabase] Invalid mistakes for completion:', completion.mistakes);
      return false;
    }

    const supabase = createSupabaseClient();

    // Write to Supabase first (write-through pattern)
    const { data, error } = await supabase
      .from('puzzle_completions')
      .insert({
        completion_id: completion.completionId,
        session_id: completion.sessionId,
        score: completion.score,
        difficulty: completion.difficulty,
        mistakes: completion.mistakes,
        moves: completion.moves || 0,
        duration: completion.duration,
        started_at: completion.startedAt || completion.gameStartTime,
        completed_at: completion.completedAt,
        eligible_for_leaderboard: completion.eligibleForLeaderboard || false,
        submitted_to_leaderboard: completion.submittedToLeaderboard || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error saving completion:', error);
      return false;
    }

    // Update Redis cache (fire and forget)
    const cacheKey = `completion:${completion.completionId}`;
    const { setCache } = await import('./cache.js');
    setCache(cacheKey, completion, 15 * 60).catch(err => {
      console.error('[Supabase] Failed to update cache after saving completion:', err);
    });

    console.log(`[Supabase] Saved completion: ${completion.completionId}, session: ${completion.sessionId}, score: ${completion.score}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error saving completion:', error);
    return false;
  }
}

/**
 * Get a completion by completionId
 * @param {string} completionId - The completion ID
 * @returns {Promise<object|null>} - Completion object or null if not found
 */
export async function getCompletion(completionId) {
  try {
    if (!completionId || typeof completionId !== 'string') {
      console.error('[Supabase] Invalid completionId:', completionId);
      return null;
    }

    const cacheKey = `completion:${completionId}`;

    // Cache-first read pattern
    return await cacheFirst(
      cacheKey,
      async () => {
        const supabase = createSupabaseClient();
        const { data, error } = await supabase
          .from('puzzle_completions')
          .select('*')
          .eq('completion_id', completionId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            return null;
          }
          console.error('[Supabase] Error getting completion:', error);
          return null;
        }

        if (!data) {
          return null;
        }

        // Transform Supabase format to expected format
        return {
          completionId: data.completion_id,
          sessionId: data.session_id,
          score: data.score,
          difficulty: data.difficulty,
          mistakes: data.mistakes,
          moves: data.moves,
          duration: data.duration,
          startedAt: data.started_at,
          completedAt: data.completed_at,
          eligibleForLeaderboard: data.eligible_for_leaderboard,
          submittedToLeaderboard: data.submitted_to_leaderboard,
        };
      },
      15 * 60 // 15 minutes TTL
    );
  } catch (error) {
    console.error('[Supabase] Error getting completion:', error);
    return null;
  }
}

/**
 * Validate completion for leaderboard submission
 * @param {string} completionId - The completion ID
 * @param {string} sessionId - The session ID to validate against
 * @returns {Promise<{valid: boolean, error?: string, completion?: object}>}
 */
export async function validateCompletionForLeaderboard(completionId, sessionId) {
  try {
    const completion = await getCompletion(completionId);

    if (!completion) {
      return {
        valid: false,
        error: 'Completion not found'
      };
    }

    if (completion.sessionId !== sessionId) {
      return {
        valid: false,
        error: 'Completion does not belong to this session'
      };
    }

    if (completion.eligibleForLeaderboard !== true) {
      return {
        valid: false,
        error: 'Completion is not eligible for leaderboard'
      };
    }

    if (completion.submittedToLeaderboard === true) {
      return {
        valid: false,
        error: 'Completion has already been submitted to leaderboard'
      };
    }

    return {
      valid: true,
      completion
    };
  } catch (error) {
    console.error('[Supabase] Error validating completion:', error);
    return {
      valid: false,
      error: 'Error validating completion'
    };
  }
}

/**
 * Mark a completion as submitted to leaderboard
 * @param {string} completionId - The completion ID
 * @returns {Promise<boolean>} - Success status
 */
export async function markCompletionSubmitted(completionId) {
  try {
    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from('puzzle_completions')
      .update({ submitted_to_leaderboard: true })
      .eq('completion_id', completionId);

    if (error) {
      console.error('[Supabase] Error marking completion as submitted:', error);
      return false;
    }

    // Invalidate cache
    const cacheKey = `completion:${completionId}`;
    const { deleteCache } = await import('./cache.js');
    deleteCache(cacheKey).catch(err => {
      console.error('[Supabase] Failed to invalidate cache:', err);
    });

    console.log(`[Supabase] Marked completion as submitted: ${completionId}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error marking completion as submitted:', error);
    return false;
  }
}





