import { createSupabaseClient } from './client.js';
import { getCache, setCache } from './cache.js';
import { LIFE_PURCHASE_PRICE_SATS, HOWIE_CHAT_PAYMENT } from '../../src/js/system/constants.js';

/**
 * Track a life purchase
 * @param {string} checkoutId - Checkout ID
 * @param {string} sessionId - Session ID
 * @param {string} status - 'success' or 'failed'
 * @returns {Promise<boolean>} - Success status
 */
export async function trackLifePurchase(checkoutId, sessionId, status = 'success') {
  try {
    if (!checkoutId || typeof checkoutId !== 'string') {
      console.error('[Supabase] Invalid checkoutId for life purchase:', checkoutId);
      return false;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for life purchase:', sessionId);
      return false;
    }

    const supabase = createSupabaseClient();
    const purchaseDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { error } = await supabase
      .from('life_purchases')
      .insert({
        checkout_id: checkoutId,
        session_id: sessionId,
        cost_sats: LIFE_PURCHASE_PRICE_SATS,
        purchase_date: purchaseDate,
        status: status,
      });

    if (error) {
      // Check if it's a duplicate key error (idempotency)
      if (error.code === '23505') {
        console.log(`[Supabase] Life purchase already tracked: ${checkoutId}`);
        return true; // Already processed, consider it success
      }
      console.error('[Supabase] Error tracking life purchase:', error);
      return false;
    }

    // Update Redis cache for checkout processed check
    const cacheKey = `checkout:processed:${checkoutId}`;
    await setCache(cacheKey, true, 24 * 60 * 60); // 24 hours TTL

    console.log(`[Supabase] Tracked life purchase: ${checkoutId}, session: ${sessionId}, status: ${status}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error tracking life purchase:', error);
    return false;
  }
}

/**
 * Track a conversation purchase
 * @param {string} checkoutId - Checkout ID
 * @param {string} sessionId - Session ID
 * @param {number} gameVersion - Game version
 * @param {string} status - 'success' or 'failed'
 * @returns {Promise<boolean>} - Success status
 */
export async function trackConversationPurchase(checkoutId, sessionId, gameVersion, status = 'success') {
  try {
    if (!checkoutId || typeof checkoutId !== 'string') {
      console.error('[Supabase] Invalid checkoutId for conversation purchase:', checkoutId);
      return false;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[Supabase] Invalid sessionId for conversation purchase:', sessionId);
      return false;
    }

    if (typeof gameVersion !== 'number') {
      console.error('[Supabase] Invalid gameVersion for conversation purchase:', gameVersion);
      return false;
    }

    const supabase = createSupabaseClient();
    const purchaseDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { error } = await supabase
      .from('conversation_purchases')
      .insert({
        checkout_id: checkoutId,
        session_id: sessionId,
        game_version: gameVersion,
        cost_sats: HOWIE_CHAT_PAYMENT,
        purchase_date: purchaseDate,
        status: status,
      });

    if (error) {
      // Check if it's a duplicate key error (idempotency)
      if (error.code === '23505') {
        console.log(`[Supabase] Conversation purchase already tracked: ${checkoutId}`);
        return true; // Already processed, consider it success
      }
      console.error('[Supabase] Error tracking conversation purchase:', error);
      return false;
    }

    // Update Redis cache for checkout processed check
    const cacheKey = `checkout:processed:${checkoutId}`;
    await setCache(cacheKey, true, 24 * 60 * 60); // 24 hours TTL

    console.log(`[Supabase] Tracked conversation purchase: ${checkoutId}, session: ${sessionId}, gameVersion: ${gameVersion}, status: ${status}`);
    return true;
  } catch (error) {
    console.error('[Supabase] Error tracking conversation purchase:', error);
    return false;
  }
}

/**
 * Get life purchases by date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} - Array of purchase records
 */
export async function getLifePurchasesByDate(date) {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('life_purchases')
      .select('*')
      .eq('purchase_date', date)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting life purchases by date:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Supabase] Error getting life purchases by date:', error);
    return [];
  }
}

/**
 * Get conversation purchases by date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} - Array of purchase records
 */
export async function getConversationPurchasesByDate(date) {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('conversation_purchases')
      .select('*')
      .eq('purchase_date', date)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting conversation purchases by date:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Supabase] Error getting conversation purchases by date:', error);
    return [];
  }
}

/**
 * Check if a checkout has already been processed
 * @param {string} checkoutId - The checkout ID
 * @returns {Promise<boolean>} - True if already processed
 */
export async function isCheckoutProcessed(checkoutId) {
  try {
    if (!checkoutId || typeof checkoutId !== 'string') {
      return false;
    }

    // Check Redis cache first (fast)
    const cacheKey = `checkout:processed:${checkoutId}`;
    const cached = await getCache(cacheKey);
    if (cached === true) {
      return true;
    }

    // Fallback to Supabase
    const supabase = createSupabaseClient();

    // Check both tables
    const [lifePurchase, conversationPurchase] = await Promise.all([
      supabase
        .from('life_purchases')
        .select('id')
        .eq('checkout_id', checkoutId)
        .limit(1)
        .single(),
      supabase
        .from('conversation_purchases')
        .select('id')
        .eq('checkout_id', checkoutId)
        .limit(1)
        .single(),
    ]);

    const isProcessed = 
      (lifePurchase.data !== null && !lifePurchase.error) ||
      (conversationPurchase.data !== null && !conversationPurchase.error);

    // Cache the result if found
    if (isProcessed) {
      await setCache(cacheKey, true, 24 * 60 * 60); // 24 hours TTL
    }

    return isProcessed;
  } catch (error) {
    console.error('[Supabase] Error checking if checkout is processed:', error);
    return false;
  }
}

/**
 * Mark a checkout as processed (updates cache)
 * @param {string} checkoutId - The checkout ID
 * @returns {Promise<boolean>} - Success status
 */
export async function markCheckoutProcessed(checkoutId) {
  try {
    if (!checkoutId || typeof checkoutId !== 'string') {
      return false;
    }

    const cacheKey = `checkout:processed:${checkoutId}`;
    await setCache(cacheKey, true, 24 * 60 * 60); // 24 hours TTL

    return true;
  } catch (error) {
    console.error('[Supabase] Error marking checkout as processed:', error);
    return false;
  }
}
