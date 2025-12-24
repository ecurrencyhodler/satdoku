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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatHistory.js:14',message:'loadChatHistory ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const response = await fetch('/api/tutor/chat-history');
      const data = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatHistory.js:18',message:'loadChatHistory API response',data:{success:data.success,conversationCount:data.conversationCount,paidConversationsCount:data.paidConversationsCount,requiresPayment:data.requiresPayment,historyLength:data.history?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      if (data.success && Array.isArray(data.history)) {
        setChatHistory(data.history);
        return data;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatHistory.js:24',message:'loadChatHistory returning default (no history)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return { success: true, history: [], conversationCount: 0 };
    } catch (error) {
      console.error('[useChatHistory] Error loading chat history:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatHistory.js:27',message:'loadChatHistory ERROR',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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











