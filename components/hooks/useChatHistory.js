'use client';

import { useState, useCallback } from 'react';

/**
 * Hook for managing chat history (loading, saving, clearing)
 */
export function useChatHistory() {
  const [chatHistory, setChatHistory] = useState([]);

  /**
   * Load chat history from server
   */
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/tutor/chat-history');
      const data = await response.json();

      if (data.success && Array.isArray(data.history)) {
        setChatHistory(data.history);
        return data;
      }
      return { success: true, history: [], conversationCount: 0 };
    } catch (error) {
      console.error('[useChatHistory] Error loading chat history:', error);
      return { success: false, history: [], conversationCount: 0 };
    }
  }, []);

  /**
   * Save a message to chat history
   */
  const saveMessage = useCallback(async (role, content) => {
    try {
      const response = await fetch('/api/tutor/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Reload history to get updated list
          await loadChatHistory();
        }
        return data.success;
      }
      return false;
    } catch (error) {
      console.error('[useChatHistory] Error saving message:', error);
      return false;
    }
  }, [loadChatHistory]);

  /**
   * Clear chat history
   */
  const clearChatHistory = useCallback(async () => {
    try {
      await fetch('/api/tutor/chat-history', { method: 'DELETE' });
      setChatHistory([]);
      return true;
    } catch (error) {
      console.error('[useChatHistory] Error clearing chat history:', error);
      return false;
    }
  }, []);

  return {
    chatHistory,
    loadChatHistory,
    saveMessage,
    clearChatHistory
  };
}
