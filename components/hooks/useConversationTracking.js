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
      // Calculate current conversation length (assistant messages since last conversation start)
      const currentConversationMessages = chatHistory.slice(lastConversationStartIndexRef.current);
      const assistantMessagesInCurrentConversation = currentConversationMessages.filter(
        msg => msg.role === 'assistant'
      ).length;
      const userMessagesInCurrentConversation = currentConversationMessages.filter(
        msg => msg.role === 'user'
      ).length;

      conversationLengthRef.current = assistantMessagesInCurrentConversation;
      // Don't overwrite userMessageCountRef if it's been incremented (to avoid race condition)
      // Only update from chat history if calculated value is higher (handles page refresh)
      // This prevents the useEffect from overwriting the incremented value after saveMessage
      if (userMessagesInCurrentConversation > userMessageCountRef.current) {
        userMessageCountRef.current = userMessagesInCurrentConversation;
      }

      // Check if current conversation should be closed (reached limit)
      // Close if either 5 assistant messages OR 5 user messages
      if (conversationLengthRef.current >= MAX_CONVERSATION_LENGTH || userMessageCountRef.current >= 5) {
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
        if (requiresPayment && conversationCount > 0) {
          // Payment is required, so the current conversation should be considered closed
          // (user needs to pay to start a new one)
          setIsConversationClosed(true);
        }
      }

      // If we have messages, mark conversation as started
      if (userMessagesInCurrentConversation > 0) {
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
   * Start a new conversation
   */
  const startNewConversation = useCallback(async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:125',message:'startNewConversation ENTRY',data:{currentRequiresPayment:requiresPayment,currentCount:conversationCount,currentPaidCount:paidConversationsCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Mark where this conversation starts in history
      const conversationStartIndex = chatHistory.length;

      // Check if payment is required (don't increment count yet)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:131',message:'calling conversation-count API',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/tutor/chat-history/conversation-count', {
        method: 'POST'
      });

      const data = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:135',message:'conversation-count API response',data:{success:data.success,conversationCount:data.conversationCount,paidConversationsCount:data.paidConversationsCount,requiresPayment:data.requiresPayment,error:data.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

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
        hasIncrementedForCurrentConversationRef.current = false;
        // Mark where this conversation starts in history
        lastConversationStartIndexRef.current = conversationStartIndex;
        // Reload history to get updated conversation count
        await loadChatHistory();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:154',message:'startNewConversation SUCCESS',data:{shouldRequirePayment,currentCount,paidCount:data.paidConversationsCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return { success: true, requiresPayment: shouldRequirePayment };
      } else if (data.error === 'PAYMENT_REQUIRED') {
        const currentCount = data.conversationCount || 0;
        setConversationCount(currentCount);
        // Payment required - use API's requiresPayment value
        const shouldRequirePayment = data.requiresPayment !== undefined ? data.requiresPayment : (currentCount > 0);
        setRequiresPayment(shouldRequirePayment);
        setPaidConversationsCount(data.paidConversationsCount || 0);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:162',message:'startNewConversation PAYMENT_REQUIRED',data:{shouldRequirePayment,currentCount,paidCount:data.paidConversationsCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return {
          success: false,
          requiresPayment: shouldRequirePayment,
          error: null // Don't show error message when payment is required
        };
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:168',message:'startNewConversation ERROR',data:{error:data.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
  }, [chatHistory.length, loadChatHistory, conversationCount, paidConversationsCount, requiresPayment]);

  /**
   * End current conversation (called when modal closes)
   * Don't increment conversation count - that only happens when conversation reaches 5 messages
   */
  const endConversation = useCallback(async () => {
    // Just reset for next conversation - don't increment count
    // The conversation count should only increment when the conversation
    // actually reaches 5 messages (handled by useEffect above)
    conversationStartedRef.current = false;
    userMessageCountRef.current = 0;
    hasIncrementedForCurrentConversationRef.current = false;
  }, []);

  /**
   * Reset conversation state (for new game)
   */
  const resetConversation = useCallback(() => {
    setIsConversationClosed(false);
    conversationLengthRef.current = 0;
    lastConversationStartIndexRef.current = 0;
    userMessageCountRef.current = 0;
    conversationStartedRef.current = false;
    hasIncrementedForCurrentConversationRef.current = false;
    setConversationCount(0);
    setRequiresPayment(false);
    setPaidConversationsCount(0);
  }, []);

  /**
   * Update payment status from loaded data
   */
  const updatePaymentStatus = useCallback((data) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:215',message:'updatePaymentStatus ENTRY',data:{conversationCount:data.conversationCount,paidConversationsCount:data.paidConversationsCount,requiresPayment:data.requiresPayment},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const count = data.conversationCount || 0;
    const paidCount = data.paidConversationsCount || 0;
    const apiRequiresPayment = data.requiresPayment || false;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:218',message:'updatePaymentStatus BEFORE state update',data:{count,paidCount,apiRequiresPayment,unlockCondition:count > 0 && paidCount >= count},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    setConversationCount(count);
    setPaidConversationsCount(paidCount);

    // Unlock chat if payment was made (paidCount >= count)
    // This ensures chat unlocks after payment
    if (count > 0 && paidCount >= count) {
      // Payment was made - unlock the conversation
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:224',message:'unlocking conversation (paidCount >= count)',data:{count,paidCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setIsConversationClosed(false);
      setRequiresPayment(false); // Explicitly set to false when payment confirmed
    } else if (count === 0) {
      // First conversation - always unlocked and free
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:228',message:'first conversation, unlocking',data:{count},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setIsConversationClosed(false);
      setRequiresPayment(false);
    } else {
      // Payment is required (count > paidCount) - lock the conversation
      const shouldRequirePayment = apiRequiresPayment || (count > paidCount);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:233',message:'locking conversation (payment required)',data:{count,paidCount,shouldRequirePayment},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setRequiresPayment(shouldRequirePayment);
      if (shouldRequirePayment) {
        setIsConversationClosed(true);
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useConversationTracking.js:240',message:'updatePaymentStatus EXIT',data:{count,paidCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }, [chatHistory]);

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
    conversationLengthRef,
    userMessageCountRef,
    startNewConversation,
    endConversation,
    resetConversation,
    updatePaymentStatus,
    incrementUserMessageCount
  };
}

