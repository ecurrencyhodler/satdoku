'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_USER_MESSAGES = 5; // Max user messages per conversation

/**
 * Hook for managing conversation tracking (counts, payment status, conversation state)
 * Only counts USER messages - each conversation allows 5 user messages
 */
export function useConversationTracking(chatHistory, loadChatHistory, clearChatHistory) {
  const [conversationCount, setConversationCount] = useState(0);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [paidConversationsCount, setPaidConversationsCount] = useState(0);
  const [isConversationClosed, setIsConversationClosed] = useState(false);

  const lastConversationStartIndexRef = useRef(0);
  const userMessageCountRef = useRef(0);
  const conversationStartedRef = useRef(false);
  const hasIncrementedForCurrentConversationRef = useRef(false);

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

  // Update conversation state when chat history changes
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      // Calculate user messages in current conversation
      const currentConversationMessages = chatHistory.slice(lastConversationStartIndexRef.current);
      const userMessagesInCurrentConversation = currentConversationMessages.filter(
        msg => msg.role === 'user'
      ).length;

      // Update user message count from history (handles page refresh)
      // Only update if calculated value is higher to avoid race conditions
      if (userMessagesInCurrentConversation > userMessageCountRef.current) {
        userMessageCountRef.current = userMessagesInCurrentConversation;
      }

      // Check if current conversation should be closed (reached 5 user messages)
      if (userMessageCountRef.current >= MAX_USER_MESSAGES) {
        setIsConversationClosed(true);

        // If conversation reached limit and had user messages, increment count immediately
        // This ensures the payment button appears right away
        if (userMessagesInCurrentConversation > 0 && !hasIncrementedForCurrentConversationRef.current) {
          hasIncrementedForCurrentConversationRef.current = true;

          // Optimistically update the conversation count and payment status
          // This ensures the payment button shows immediately
          // Use functional updates to ensure we use current state values
          setConversationCount(prevCount => {
            const newCount = prevCount + 1;
            // Update requiresPayment optimistically based on current state
            // Payment is required if newCount > 0 and newCount > paidConversationsCount
            // We read paidConversationsCount from closure (current value when effect runs)
            const currentPaid = paidConversationsCount;
            const canStartWithoutPayment = newCount === 0 || (newCount <= currentPaid);
            setRequiresPayment(!canStartWithoutPayment);
            return newCount;
          });

          // Then update from server to get accurate values (will correct requiresPayment if needed)
          incrementConversationCount();
        }
      } else {
        // If conversation hasn't reached limit, check if it should still be closed
        // This handles the case where payment is required (conversation was completed previously)
        // In that case, we want to keep it closed until payment is made
        // IMPORTANT: Check paidConversationsCount to avoid race condition where requiresPayment
        // might be stale after payment unlocks the chat
        // FIX: Only close if we're NOT in an active conversation (conversationStartedRef.current is false)
        // This prevents closing a newly started conversation after payment
        if (requiresPayment && conversationCount > 0 && conversationCount > paidConversationsCount && !conversationStartedRef.current) {
          // Payment is required, so the current conversation should be considered closed
          // (user needs to pay to start a new one)
          setIsConversationClosed(true);
        } else if (conversationCount > 0 && paidConversationsCount >= conversationCount) {
          // Payment was made - ensure conversation is unlocked
          setIsConversationClosed(false);
        } else if (conversationStartedRef.current && userMessageCountRef.current < MAX_USER_MESSAGES) {
          // Active conversation that hasn't reached limit - ensure it's open
          setIsConversationClosed(false);
        }
      }

      // If we have messages AND conversation hasn't been completed yet, mark as started
      // Don't overwrite if conversation was completed (to allow starting new conversation)
      if (userMessagesInCurrentConversation > 0 && userMessagesInCurrentConversation < 5) {
        conversationStartedRef.current = true;
      }
    } else if (chatHistory && chatHistory.length === 0) {
      // No chat history - only close if payment is required (conversationCount > paidConversationsCount)
      // This handles the case where page is refreshed after a conversation was completed
      // But don't close if payment was made (paidConversationsCount >= conversationCount)
      if (conversationCount > 0 && conversationCount > paidConversationsCount) {
        setIsConversationClosed(true);
      } else {
        // Payment was made or no conversations yet - conversation should be open
        setIsConversationClosed(false);
      }
    }
  }, [chatHistory, incrementConversationCount, paidConversationsCount, requiresPayment, conversationCount]);

  /**
   * Update payment status from loaded data
   */
  const updatePaymentStatus = useCallback((data) => {
    const count = data.conversationCount || 0;
    const paidCount = data.paidConversationsCount || 0;
    const apiRequiresPayment = data.requiresPayment || false;
    
    console.log('[useConversationTracking] updatePaymentStatus called', {
      count,
      paidCount,
      apiRequiresPayment,
      historyLength: chatHistory.length,
      currentRefs: {
        conversationStarted: conversationStartedRef.current,
        userMessageCount: userMessageCountRef.current,
        hasIncremented: hasIncrementedForCurrentConversationRef.current,
        lastStartIndex: lastConversationStartIndexRef.current
      }
    });
    
    setConversationCount(count);
    setPaidConversationsCount(paidCount);

    // Unlock chat if payment was made (paidCount >= count)
    // This ensures chat unlocks after payment
    if (count > 0 && paidCount >= count) {
      console.log('[useConversationTracking] Payment confirmed, unlocking and resetting refs');
      // Payment was made - unlock the conversation
      setIsConversationClosed(false);
      setRequiresPayment(false); // Explicitly set to false when payment confirmed
      // Reset conversation refs to allow starting fresh conversation after payment
      // This prevents the "conversation already active" check from blocking new conversation
      conversationStartedRef.current = false;
      userMessageCountRef.current = 0;
      // CRITICAL FIX: Mark as incremented to prevent the useEffect from double-incrementing
      // when it sees the old completed conversation in chatHistory
      hasIncrementedForCurrentConversationRef.current = true;
      lastConversationStartIndexRef.current = chatHistory.length; // Start from current history length
    } else if (count === 0) {
      // First conversation - always unlocked and free
      setIsConversationClosed(false);
      setRequiresPayment(false);
    } else {
      console.log('[useConversationTracking] Payment required', { count, paidCount });
      // Payment is required (count > paidCount) - lock the conversation
      const shouldRequirePayment = apiRequiresPayment || (count > paidCount);
      setRequiresPayment(shouldRequirePayment);
      if (shouldRequirePayment) {
        setIsConversationClosed(true);
        // Mark as incremented to prevent double-counting when reloading history
        hasIncrementedForCurrentConversationRef.current = true;
      }
    }
  }, [chatHistory.length]);

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(async () => {
    try {
      console.log('[useConversationTracking] startNewConversation called', {
        conversationStarted: conversationStartedRef.current,
        userMessageCount: userMessageCountRef.current,
        chatHistoryLength: chatHistory.length
      });
      
      // If a conversation is already active, don't start a new one
      // This prevents resetting the conversation start index when reopening chat
      if (conversationStartedRef.current) {
        console.log('[useConversationTracking] Conversation already active, not starting new one');
        return { success: true, requiresPayment: false };
      }

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
        
        // Mark where this NEW conversation starts in history
        // This allows previous conversation messages to remain visible
        // but new message counting starts from this point
        const conversationStartIndex = chatHistory.length;
        
        // Reset conversation state for new conversation
        setIsConversationClosed(false);
        userMessageCountRef.current = 0;
        conversationStartedRef.current = true;
        hasIncrementedForCurrentConversationRef.current = false;
        lastConversationStartIndexRef.current = conversationStartIndex;
        
        console.log('[useConversationTracking] Started new conversation', {
          conversationCount: currentCount,
          paidCount: data.paidConversationsCount,
          startIndex: conversationStartIndex,
          historyLength: chatHistory.length
        });
        
        // Reload history to get updated conversation count
        // This ensures payment status is current
        const historyData = await loadChatHistory();
        if (historyData.success) {
          // Update payment status from loaded data to ensure consistency
          updatePaymentStatus(historyData);
        }
        
        // Explicitly ensure conversation is open after all async operations complete
        // This prevents "Conversation closed" from showing when chat first opens after payment
        setIsConversationClosed(false);
        
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
          error: null // Don't show error message when payment is required
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
  }, [chatHistory.length, loadChatHistory, conversationCount, paidConversationsCount, requiresPayment, updatePaymentStatus]);

  /**
   * End current conversation (called when modal closes)
   * Don't increment conversation count - that only happens when conversation reaches 5 messages
   * Don't reset counters - they need to persist to prevent messaging in completed conversations
   */
  const endConversation = useCallback(async () => {
    // Don't reset any counters here - they need to persist across chat open/close
    // to ensure the conversation limit is properly enforced
    // The counters will be reset when a new conversation actually starts
    // (after payment or for a new game)
  }, []);

  /**
   * Reset conversation state (for new game)
   */
  const resetConversation = useCallback(() => {
    setIsConversationClosed(false);
    lastConversationStartIndexRef.current = 0;
    userMessageCountRef.current = 0;
    conversationStartedRef.current = false;
    hasIncrementedForCurrentConversationRef.current = false;
    setConversationCount(0);
    setRequiresPayment(false);
    setPaidConversationsCount(0);
  }, []);

  /**
   * Increment user message count (called when user sends a message)
   */
  const incrementUserMessageCount = useCallback(() => {
    userMessageCountRef.current += 1;

    // Check if conversation is complete (5 user messages)
    if (userMessageCountRef.current >= 5) {
      // Only increment if we haven't already incremented for this conversation
      // (the useEffect might have already incremented it when the 5th assistant message arrived)
      if (!hasIncrementedForCurrentConversationRef.current) {
        hasIncrementedForCurrentConversationRef.current = true;
        incrementConversationCount();
      }
      setIsConversationClosed(true);
      // Reset for next conversation
      conversationStartedRef.current = false;
      userMessageCountRef.current = 0;
    }
  }, [incrementConversationCount]);

  // Ensure conversation is closed when payment is required (handles page refresh case)
  // But don't override unlocking after payment
  useEffect(() => {
    // Only close if payment is required AND we haven't paid (count > paidCount)
    // Don't close if payment was made (paidCount >= count)
    if (requiresPayment && conversationCount > 0 && conversationCount > paidConversationsCount) {
      setIsConversationClosed(true);
    } else if (conversationCount > 0 && paidConversationsCount >= conversationCount) {
      // Payment was made - ensure conversation is unlocked
      setIsConversationClosed(false);
      setRequiresPayment(false);
    } else if (conversationCount === 0) {
      setIsConversationClosed(false);
      setRequiresPayment(false);
    }
  }, [requiresPayment, conversationCount, paidConversationsCount]);

  // Ensure first conversation (count 0) never requires payment
  const actualRequiresPayment = conversationCount === 0 ? false : requiresPayment;
  const actualCanStartNewConversation = conversationCount === 0 ? true : !requiresPayment;

  return {
    conversationCount,
    requiresPayment: actualRequiresPayment,
    paidConversationsCount,
    isConversationClosed,
    canStartNewConversation: actualCanStartNewConversation,
    userMessageCountRef,
    startNewConversation,
    endConversation,
    resetConversation,
    updatePaymentStatus,
    incrementUserMessageCount
  };
}
