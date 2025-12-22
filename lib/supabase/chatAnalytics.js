import { createSupabaseClient } from './client.js';

/**
 * Save a conversation to Supabase
 * @param {object} conversation - Conversation object
 * @returns {Promise<boolean>} Success status
 */
export async function saveConversation(conversation) {
  try {
    if (!conversation || !conversation.conversationId) {
      console.error('[chatAnalytics] Invalid conversation object:', conversation);
      return false;
    }

    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from('tutor_conversations')
      .upsert({
        conversation_id: conversation.conversationId,
        session_id: conversation.sessionId,
        started_at: conversation.startedAt,
        date: conversation.date,
        game_version: conversation.gameVersion || null,
        last_message_at: conversation.lastMessageAt || null,
      }, {
        onConflict: 'conversation_id'
      });

    if (error) {
      console.error('[chatAnalytics] Error saving conversation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chatAnalytics] Error saving conversation:', error);
    return false;
  }
}

/**
 * Update or create message counts for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {number} totalMessages - Total message count
 * @param {number} userMessages - User message count
 * @returns {Promise<boolean>} Success status
 */
export async function upsertMessageCounts(conversationId, totalMessages, userMessages) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      console.error('[chatAnalytics] Invalid conversationId:', conversationId);
      return false;
    }

    if (typeof totalMessages !== 'number' || typeof userMessages !== 'number') {
      console.error('[chatAnalytics] Invalid message counts:', { totalMessages, userMessages });
      return false;
    }

    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from('tutor_messages')
      .upsert({
        conversation_id: conversationId,
        total_messages: totalMessages,
        user_messages: userMessages,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'conversation_id'
      });

    if (error) {
      console.error('[chatAnalytics] Error upserting message counts:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chatAnalytics] Error upserting message counts:', error);
    return false;
  }
}

/**
 * Update last message timestamp for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} lastMessageAt - ISO timestamp
 * @returns {Promise<boolean>} Success status
 */
export async function updateConversationLastMessage(conversationId, lastMessageAt) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      console.error('[chatAnalytics] Invalid conversationId:', conversationId);
      return false;
    }

    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from('tutor_conversations')
      .update({
        last_message_at: lastMessageAt,
      })
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('[chatAnalytics] Error updating conversation last message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[chatAnalytics] Error updating conversation last message:', error);
    return false;
  }
}

/**
 * Mark a conversation as completed in Supabase
 * Ensures the conversation exists and updates last_message_at
 * @param {string} conversationId - Conversation ID
 * @param {string} sessionId - Session ID
 * @param {number} gameVersion - Game version
 * @returns {Promise<boolean>} Success status
 */
export async function markConversationCompleted(conversationId, sessionId, gameVersion) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      console.error('[chatAnalytics] Invalid conversationId:', conversationId);
      return false;
    }

    const supabase = createSupabaseClient();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD format

    // First, check if conversation already exists
    const { data: existingConversation, error: fetchError } = await supabase
      .from('tutor_conversations')
      .select('conversation_id, started_at')
      .eq('conversation_id', conversationId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if conversation doesn't exist
      console.error('[chatAnalytics] Error checking for existing conversation:', fetchError);
      return false;
    }

    if (existingConversation) {
      // Conversation exists - just update last_message_at to mark as completed
      const { error } = await supabase
        .from('tutor_conversations')
        .update({
          last_message_at: now,
        })
        .eq('conversation_id', conversationId);

      if (error) {
        console.error('[chatAnalytics] Error updating conversation completion:', error);
        return false;
      }
    } else {
      // Conversation doesn't exist - create it with completion timestamp
      // This handles the case where trackConversationOpened wasn't called
      const { error } = await supabase
        .from('tutor_conversations')
        .insert({
          conversation_id: conversationId,
          session_id: sessionId,
          started_at: now,
          date: date,
          game_version: gameVersion || null,
          last_message_at: now,
        });

      if (error) {
        console.error('[chatAnalytics] Error creating completed conversation:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[chatAnalytics] Error marking conversation as completed:', error);
    return false;
  }
}


