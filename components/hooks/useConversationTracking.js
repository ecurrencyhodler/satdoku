'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_CONVERSATION_LENGTH = 5; // Max assistant messages per conversation

/**
 * Hook for managing conversation tracking (counts, payment status, conversation state)
 */
export function useConversationTracking(chatHistory, loadChatHistory) {
  const [conversationCount, setConversationCount] = useState(0);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [paidConversationsCount, setPaidConversationsCount] = useState(0);
  const [isConversationClosed, setIsConversationClosed] = useState(false);
  
  const conversationLengthRef = useRef(0);
  const lastConversationStartIndexRef = useRef(0);
  const userMessageCountRef = useRef(0);
  const conversationStartedRef = useRef(false);

  // Update conversation state when chat history changes
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      // Calculate current conversation length (assistant messages since last conversation start)
      const currentConversationMessages = chatHistory.slice(lastConversationStartIndexRef.current);
      const assistantMessagesInCurrentConversation = currentConversationMessages.filter(
        msg => msg.role === 'assistant'
      ).length;
      const userMessagesInCurrentConversation = currentConversationMessages.filter(
        msg => msg.role === 'user'
      ).length;
      
      conversationLengthRef.current = assistantMessagesInCurrentConversation;
      userMessageCountRef.current = userMessagesInCurrentConversation;

      // Check if current conversation should be closed (reached limit)
      if (conversationLengthRef.current >= MAX_CONVERSATION_LENGTH) {
        setIsConversationClosed(true);
      }

      // If we have messages, mark conversation as started
      if (userMessagesInCurrentConversation > 0) {
        conversationStartedRef.current = true;
      }
    }
  }, [chatHistory]);

  /**
   * Increment conversation count when conversation completes
   */
  const incrementConversationCount = useCallback(async () => {
    try {
      const response = await fetch('/api/tutor/chat-history/conversation-count', {
        method: 'PUT'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConversationCount(data.conversationCount);
          setPaidConversationsCount(data.paidConversationsCount || 0);
          // Check if payment is now required for next conversation
          const canStartWithoutPayment = data.conversationCount === 0 || 
            (data.conversationCount <= (data.paidConversationsCount || 0));
          setRequiresPayment(!canStartWithoutPayment);
        }
      }
    } catch (error) {
      console.error('[useConversationTracking] Error incrementing conversation count:', error);
    }
  }, []);

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(async () => {
    try {
      // Mark where this conversation starts in history
      const conversationStartIndex = chatHistory.length;

      // Check if payment is required (don't increment count yet)
      const response = await fetch('/api/tutor/chat-history/conversation-count', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        const currentCount = data.conversationCount;
        setConversationCount(currentCount);
        // Use API's requiresPayment value directly since it's calculated correctly
        const shouldRequirePayment = data.requiresPayment || false;
        setRequiresPayment(shouldRequirePayment);
        setPaidConversationsCount(data.paidConversationsCount || 0);
        // Reset conversation state for new conversation
        setIsConversationClosed(false);
        conversationLengthRef.current = 0;
        userMessageCountRef.current = 0;
        conversationStartedRef.current = true;
        // Mark where this conversation starts in history
        lastConversationStartIndexRef.current = conversationStartIndex;
        // Reload history to get updated conversation count
        await loadChatHistory();
        return { success: true, requiresPayment: shouldRequirePayment };
      } else if (data.error === 'PAYMENT_REQUIRED') {
        const currentCount = data.conversationCount || 0;
        setConversationCount(currentCount);
        // Payment required - use API's requiresPayment value
        const shouldRequirePayment = data.requiresPayment !== undefined ? data.requiresPayment : (currentCount > 0);
        setRequiresPayment(shouldRequirePayment);
        setPaidConversationsCount(data.paidConversationsCount || 0);
        return { 
          success: false, 
          requiresPayment: shouldRequirePayment,
          error: shouldRequirePayment ? 'Payment required to start a new conversation' : 'Failed to start conversation'
        };
      } else {
        return { 
          success: false, 
          requiresPayment: false,
          error: data.message || 'Failed to start new conversation'
        };
      }
    } catch (error) {
      console.error('[useConversationTracking] Error starting new conversation:', error);
      return { 
        success: false, 
        requiresPayment: false,
        error: 'Failed to start new conversation'
      };
    }
  }, [chatHistory.length, loadChatHistory]);

  /**
   * End current conversation (called when modal closes)
   * Increment conversation count if conversation had messages
   */
  const endConversation = useCallback(async () => {
    // If conversation was started and had user messages, increment count
    if (conversationStartedRef.current && userMessageCountRef.current > 0) {
      await incrementConversationCount();
      // Reset for next conversation
      conversationStartedRef.current = false;
      userMessageCountRef.current = 0;
    }
  }, [incrementConversationCount]);

  /**
   * Reset conversation state (for new game)
   */
  const resetConversation = useCallback(() => {
    setIsConversationClosed(false);
    conversationLengthRef.current = 0;
    lastConversationStartIndexRef.current = 0;
    userMessageCountRef.current = 0;
    conversationStartedRef.current = false;
    setConversationCount(0);
    setRequiresPayment(false);
    setPaidConversationsCount(0);
  }, []);

  /**
   * Update payment status from loaded data
   */
  const updatePaymentStatus = useCallback((data) => {
    const count = data.conversationCount || 0;
    setConversationCount(count);
    // First conversation (count 0) is ALWAYS free
    const shouldRequirePayment = count === 0 ? false : (data.requiresPayment || false);
    setRequiresPayment(shouldRequirePayment);
    setPaidConversationsCount(data.paidConversationsCount || 0);
  }, []);

  /**
   * Increment user message count (called when user sends a message)
   */
  const incrementUserMessageCount = useCallback(() => {
    userMessageCountRef.current += 1;
    
    // Check if conversation is complete (5 user messages)
    if (userMessageCountRef.current >= 5) {
      incrementConversationCount();
      setIsConversationClosed(true);
      // Reset for next conversation
      conversationStartedRef.current = false;
      userMessageCountRef.current = 0;
    }
  }, [incrementConversationCount]);

  // Ensure first conversation (count 0) never requires payment
  const actualRequiresPayment = conversationCount === 0 ? false : requiresPayment;
  const actualCanStartNewConversation = conversationCount === 0 ? true : !requiresPayment;

  return {
    conversationCount,
    requiresPayment: actualRequiresPayment,
    paidConversationsCount,
    isConversationClosed,
    canStartNewConversation: actualCanStartNewConversation,
    conversationLengthRef,
    userMessageCountRef,
    startNewConversation,
    endConversation,
    resetConversation,
    updatePaymentStatus,
    incrementUserMessageCount
  };
}
