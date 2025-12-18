import { getRedisClient, resetRedisClient } from './client.js';

// TTL for analytics data - 2 years for long-term tracking
const ANALYTICS_TTL = 2 * 365 * 24 * 60 * 60; // 2 years

/**
 * Generate a unique conversation ID
 * @returns {string} Unique conversation ID
 */
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get date string in YYYY-MM-DD format
 * @param {Date} date - Date object (defaults to now)
 * @returns {string} Date string
 */
function getDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Track when a conversation is opened
 * @param {string} sessionId - Session ID
 * @param {number} gameVersion - Game version (optional)
 * @returns {Promise<{success: boolean, conversationId?: string, error?: string}>}
 */
export async function trackConversationOpened(sessionId, gameVersion = null) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[tutorAnalytics] Invalid sessionId:', sessionId);
      return { success: false, error: 'Invalid sessionId' };
    }

    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutorAnalytics] Redis not available');
      return { success: false, error: 'Redis not available' };
    }

    const conversationId = generateConversationId();
    const now = new Date();
    const date = getDateString(now);

    // Store conversation metadata
    const conversationKey = `tutor_analytics:conversation:${conversationId}`;
    const conversationData = {
      sessionId,
      date,
      startedAt: now.toISOString(),
      gameVersion: gameVersion?.toString() || null
    };
    await redis.setEx(conversationKey, ANALYTICS_TTL, JSON.stringify(conversationData));

    // Track conversation for this session
    const sessionConversationsKey = `tutor_analytics:conversations:${sessionId}`;
    await redis.sAdd(sessionConversationsKey, conversationId);
    await redis.expire(sessionConversationsKey, ANALYTICS_TTL);

    // Track conversation for this date
    const dateConversationsKey = `tutor_analytics:conversations:date:${date}`;
    await redis.sAdd(dateConversationsKey, conversationId);
    await redis.expire(dateConversationsKey, ANALYTICS_TTL);

    // Increment total conversations counter for this session
    const totalConversationsKey = `tutor_analytics:total_conversations:${sessionId}`;
    await redis.incr(totalConversationsKey);
    await redis.expire(totalConversationsKey, ANALYTICS_TTL);

    // Set as current conversation for this session
    const currentConversationKey = `tutor_analytics:current_conversation:${sessionId}`;
    await redis.setEx(currentConversationKey, ANALYTICS_TTL, conversationId);

    console.log(`[tutorAnalytics] Tracked conversation opened: ${conversationId}, session: ${sessionId}, date: ${date}`);
    return { success: true, conversationId };
  } catch (error) {
    console.error('[tutorAnalytics] Error tracking conversation opened:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return { success: false, error: error.message };
  }
}

/**
 * Track a message sent in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} sessionId - Session ID
 * @param {string} role - Message role ('user' or 'assistant')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function trackMessage(conversationId, sessionId, role) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      console.error('[tutorAnalytics] Invalid conversationId:', conversationId);
      return { success: false, error: 'Invalid conversationId' };
    }

    if (!sessionId || typeof sessionId !== 'string') {
      console.error('[tutorAnalytics] Invalid sessionId:', sessionId);
      return { success: false, error: 'Invalid sessionId' };
    }

    if (role !== 'user' && role !== 'assistant') {
      console.error('[tutorAnalytics] Invalid role:', role);
      return { success: false, error: 'Invalid role' };
    }

    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[tutorAnalytics] Redis not available');
      return { success: false, error: 'Redis not available' };
    }

    const now = new Date();
    const date = getDateString(now);

    // Increment total messages counter for this conversation
    const messagesKey = `tutor_analytics:messages:${conversationId}`;
    await redis.incr(messagesKey);
    await redis.expire(messagesKey, ANALYTICS_TTL);

    // If it's a user message, increment user messages counter (responses)
    if (role === 'user') {
      const userMessagesKey = `tutor_analytics:user_messages:${conversationId}`;
      await redis.incr(userMessagesKey);
      await redis.expire(userMessagesKey, ANALYTICS_TTL);
    }

    // Update conversation metadata with last message date if needed
    const conversationKey = `tutor_analytics:conversation:${conversationId}`;
    const conversationDataStr = await redis.get(conversationKey);
    if (conversationDataStr) {
      const conversationData = JSON.parse(conversationDataStr);
      conversationData.lastMessageAt = now.toISOString();
      conversationData.lastMessageDate = date;
      await redis.setEx(conversationKey, ANALYTICS_TTL, JSON.stringify(conversationData));
    }

    return { success: true };
  } catch (error) {
    console.error('[tutorAnalytics] Error tracking message:', error);
    if (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED')) {
      resetRedisClient();
    }
    return { success: false, error: error.message };
  }
}

/**
 * Get total conversations for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<number>} Total conversation count
 */
export async function getTotalConversationsForSession(sessionId) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return 0;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return 0;
    }

    const totalConversationsKey = `tutor_analytics:total_conversations:${sessionId}`;
    const count = await redis.get(totalConversationsKey);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('[tutorAnalytics] Error getting total conversations:', error);
    return 0;
  }
}

/**
 * Get conversation metadata
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<object|null>} Conversation data or null
 */
export async function getConversationData(conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      return null;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return null;
    }

    const conversationKey = `tutor_analytics:conversation:${conversationId}`;
    const data = await redis.get(conversationKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[tutorAnalytics] Error getting conversation data:', error);
    return null;
  }
}

/**
 * Get message counts for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<{totalMessages: number, userMessages: number}>}
 */
export async function getConversationMessageCounts(conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      return { totalMessages: 0, userMessages: 0 };
    }

    const redis = await getRedisClient();
    if (!redis) {
      return { totalMessages: 0, userMessages: 0 };
    }

    const messagesKey = `tutor_analytics:messages:${conversationId}`;
    const userMessagesKey = `tutor_analytics:user_messages:${conversationId}`;

    const [totalMessages, userMessages] = await Promise.all([
      redis.get(messagesKey),
      redis.get(userMessagesKey)
    ]);

    return {
      totalMessages: totalMessages ? parseInt(totalMessages, 10) : 0,
      userMessages: userMessages ? parseInt(userMessages, 10) : 0
    };
  } catch (error) {
    console.error('[tutorAnalytics] Error getting message counts:', error);
    return { totalMessages: 0, userMessages: 0 };
  }
}

/**
 * Get all conversation IDs for a specific date
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Promise<string[]>} Array of conversation IDs
 */
export async function getConversationsForDate(date) {
  try {
    if (!date || typeof date !== 'string') {
      return [];
    }

    const redis = await getRedisClient();
    if (!redis) {
      return [];
    }

    const dateConversationsKey = `tutor_analytics:conversations:date:${date}`;
    const conversationIds = await redis.sMembers(dateConversationsKey);
    return conversationIds || [];
  } catch (error) {
    console.error('[tutorAnalytics] Error getting conversations for date:', error);
    return [];
  }
}

/**
 * Get all conversation IDs for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<string[]>} Array of conversation IDs
 */
export async function getConversationsForSession(sessionId) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return [];
    }

    const redis = await getRedisClient();
    if (!redis) {
      return [];
    }

    const sessionConversationsKey = `tutor_analytics:conversations:${sessionId}`;
    const conversationIds = await redis.sMembers(sessionConversationsKey);
    return conversationIds || [];
  } catch (error) {
    console.error('[tutorAnalytics] Error getting conversations for session:', error);
    return [];
  }
}

/**
 * Get the current active conversation ID for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<string|null>} Current conversation ID or null
 */
export async function getCurrentConversationId(sessionId) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return null;
    }

    const currentConversationKey = `tutor_analytics:current_conversation:${sessionId}`;
    const conversationId = await redis.get(currentConversationKey);
    return conversationId || null;
  } catch (error) {
    console.error('[tutorAnalytics] Error getting current conversation ID:', error);
    return null;
  }
}

/**
 * Set the current active conversation ID for a session
 * @param {string} sessionId - Session ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} Success status
 */
export async function setCurrentConversationId(sessionId, conversationId) {
  try {
    if (!sessionId || typeof sessionId !== 'string' || !conversationId || typeof conversationId !== 'string') {
      return false;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }

    const currentConversationKey = `tutor_analytics:current_conversation:${sessionId}`;
    await redis.setEx(currentConversationKey, ANALYTICS_TTL, conversationId);
    return true;
  } catch (error) {
    console.error('[tutorAnalytics] Error setting current conversation ID:', error);
    return false;
  }
}

