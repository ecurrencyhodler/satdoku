import { createSupabaseClient } from './client.js';
import { getCache, setCache } from './cache.js';

/**
 * Log trigger to Supabase and update Redis cache (fire-and-forget, non-blocking)
 * @returns {Promise<void>}
 */
export async function logTrigger() {
  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    const supabase = createSupabaseClient();

    // Upsert into Supabase (increment trigger_count)
    const { data: existing } = await supabase
      .from('answer_leak_triggers')
      .select('trigger_count')
      .eq('trigger_date', dateKey)
      .single();

    if (existing && !existing.error) {
      // Update existing
      const { error } = await supabase
        .from('answer_leak_triggers')
        .update({
          trigger_count: existing.trigger_count + 1,
          updated_at: now.toISOString()
        })
        .eq('trigger_date', dateKey);

      if (error) {
        console.error('[Supabase] Error updating trigger count:', error);
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('answer_leak_triggers')
        .insert({
          trigger_date: dateKey,
          trigger_count: 1,
          detected_count: 0
        });

      if (error) {
        console.error('[Supabase] Error inserting trigger:', error);
      }
    }

    // Update Redis daily aggregation cache (fire and forget)
    const cacheKey = `answer_leak:stats:${dateKey}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      cached.trigger_count = (cached.trigger_count || 0) + 1;
      setCache(cacheKey, cached, 60 * 60).catch(() => {}); // 1 hour TTL
    } else {
      // Fetch from Supabase and cache
      const { data } = await supabase
        .from('answer_leak_triggers')
        .select('*')
        .eq('trigger_date', dateKey)
        .single();

      if (data) {
        setCache(cacheKey, data, 60 * 60).catch(() => {}); // 1 hour TTL
      }
    }
  } catch (error) {
    // Silently fail - logging should not break the leak detection
    console.error('[Supabase] Error logging trigger:', error);
  }
}

/**
 * Log leak detection to Supabase and update Redis cache (fire-and-forget, non-blocking)
 * @returns {Promise<void>}
 */
export async function logLeakDetected() {
  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    const supabase = createSupabaseClient();

    // Upsert into Supabase (increment detected_count)
    const { data: existing } = await supabase
      .from('answer_leak_triggers')
      .select('detected_count')
      .eq('trigger_date', dateKey)
      .single();

    if (existing && !existing.error) {
      // Update existing
      const { error } = await supabase
        .from('answer_leak_triggers')
        .update({
          detected_count: existing.detected_count + 1,
          updated_at: now.toISOString()
        })
        .eq('trigger_date', dateKey);

      if (error) {
        console.error('[Supabase] Error updating detected count:', error);
      }
    } else {
      // Insert new (trigger should have been logged first, but handle gracefully)
      const { error } = await supabase
        .from('answer_leak_triggers')
        .insert({
          trigger_date: dateKey,
          trigger_count: 0,
          detected_count: 1
        });

      if (error) {
        console.error('[Supabase] Error inserting detected count:', error);
      }
    }

    // Update Redis daily aggregation cache (fire and forget)
    const cacheKey = `answer_leak:stats:${dateKey}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      cached.detected_count = (cached.detected_count || 0) + 1;
      setCache(cacheKey, cached, 60 * 60).catch(() => {}); // 1 hour TTL
    } else {
      // Fetch from Supabase and cache
      const { data } = await supabase
        .from('answer_leak_triggers')
        .select('*')
        .eq('trigger_date', dateKey)
        .single();

      if (data) {
        setCache(cacheKey, data, 60 * 60).catch(() => {}); // 1 hour TTL
      }
    }
  } catch (error) {
    // Silently fail - logging should not break the leak detection
    console.error('[Supabase] Error logging leak detection:', error);
  }
}

/**
 * Get trigger stats by date or total
 * @param {string|null} date - Date in YYYY-MM-DD format, or null for total
 * @returns {Promise<{trigger_count: number, detected_count: number}|null>} - Stats or null
 */
export async function getTriggerStats(date = null) {
  try {
    const supabase = createSupabaseClient();

    if (date) {
      // Get specific date - check cache first
      const cacheKey = `answer_leak:stats:${date}`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return {
          trigger_count: cached.trigger_count || 0,
          detected_count: cached.detected_count || 0
        };
      }

      // Cache miss - fetch from Supabase
      const { data, error } = await supabase
        .from('answer_leak_triggers')
        .select('trigger_count, detected_count')
        .eq('trigger_date', date)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return { trigger_count: 0, detected_count: 0 };
        }
        console.error('[Supabase] Error getting trigger stats:', error);
        return null;
      }

      if (!data) {
        return { trigger_count: 0, detected_count: 0 };
      }

      // Cache the result
      setCache(cacheKey, data, 60 * 60).catch(() => {}); // 1 hour TTL

      return {
        trigger_count: data.trigger_count || 0,
        detected_count: data.detected_count || 0
      };
    } else {
      // Get total across all dates
      const { data, error } = await supabase
        .from('answer_leak_triggers')
        .select('trigger_count, detected_count');

      if (error) {
        console.error('[Supabase] Error getting total trigger stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return { trigger_count: 0, detected_count: 0 };
      }

      const total = data.reduce(
        (acc, row) => ({
          trigger_count: acc.trigger_count + (row.trigger_count || 0),
          detected_count: acc.detected_count + (row.detected_count || 0)
        }),
        { trigger_count: 0, detected_count: 0 }
      );

      return total;
    }
  } catch (error) {
    console.error('[Supabase] Error getting trigger stats:', error);
    return null;
  }
}



