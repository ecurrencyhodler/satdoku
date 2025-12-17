'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const MAX_CONVERSATION_LENGTH = 5; // Max assistant messages per conversation
const MAX_CONVERSATIONS_PER_GAME = 5; // Max conversations per game

/**
 * Custom hook for tutor chat functionality
 */
export function useTutorChat(gameState, selectedCell) {
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConversationClosed, setIsConversationClosed] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);
  const conversationLengthRef = useRef(0);
  const lastConversationStartIndexRef = useRef(0); // Track where current conversation started

  // Load chat history and conversation count on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Reset conversation when game state changes (new game)
  useEffect(() => {
    if (gameState) {
      // Reset conversation state for new game
      setIsConversationClosed(false);
      conversationLengthRef.current = 0;
      lastConversationStartIndexRef.current = 0;
      setConversationCount(0);
      // Clear chat history when new game starts
      clearChatHistory();
    }
  }, [gameState?.version]); // Reset when game version changes (new game)

  /**
   * Load chat history and conversation count from server
   */
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/tutor/chat-history');
      const data = await response.json();

      if (data.success && Array.isArray(data.history)) {
        setChatHistory(data.history);
        setConversationCount(data.conversationCount || 0);

        // Calculate current conversation length (assistant messages since last conversation start)
        const currentConversationMessages = data.history.slice(lastConversationStartIndexRef.current);
        const assistantMessagesInCurrentConversation = currentConversationMessages.filter(
          msg => msg.role === 'assistant'
        ).length;
        conversationLengthRef.current = assistantMessagesInCurrentConversation;

        // Check if current conversation should be closed (reached limit)
        if (conversationLengthRef.current >= MAX_CONVERSATION_LENGTH) {
          setIsConversationClosed(true);
        }
      }
    } catch (error) {
      console.error('[useTutorChat] Error loading chat history:', error);
    }
  }, []);

  /**
   * Clear chat history
   */
  const clearChatHistory = useCallback(async () => {
    try {
      await fetch('/api/tutor/chat-history', { method: 'DELETE' });
      setChatHistory([]);
      conversationLengthRef.current = 0;
      lastConversationStartIndexRef.current = 0;
      setIsConversationClosed(false);
      setConversationCount(0);
    } catch (error) {
      console.error('[useTutorChat] Error clearing chat history:', error);
    }
  }, []);

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(async () => {
    // Check if we can start a new conversation
    if (conversationCount >= MAX_CONVERSATIONS_PER_GAME) {
      setError('Maximum conversations per game reached. Start a new game to chat again.');
      return false;
    }

    try {
      // Mark where this conversation starts in history (before incrementing)
      // At this point, no new messages have been added yet, so current length is the start
      const conversationStartIndex = chatHistory.length;

      // Increment conversation count
      const response = await fetch('/api/tutor/chat-history/conversation-count', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setConversationCount(data.conversationCount);
        // Reset conversation state for new conversation
        setIsConversationClosed(false);
        conversationLengthRef.current = 0;
        // Mark where this conversation starts in history
        lastConversationStartIndexRef.current = conversationStartIndex;
        // Reload history to get updated conversation count
        await loadChatHistory();
        setError(null);
        return true;
      } else if (data.error === 'MAX_CONVERSATIONS_REACHED') {
        setConversationCount(data.conversationCount);
        setError('Maximum conversations per game reached. Start a new game to chat again.');
        return false;
      } else {
        setError(data.message || 'Failed to start new conversation');
        return false;
      }
    } catch (error) {
      console.error('[useTutorChat] Error starting new conversation:', error);
      setError('Failed to start new conversation');
      return false;
    }
  }, [conversationCount, chatHistory.length, loadChatHistory]);

  /**
   * End current conversation (called when modal closes)
   */
  const endConversation = useCallback(() => {
    // Just mark that the conversation has ended
    // The conversation count has already been incremented when it started
    // No need to do anything special here
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
      }
    } catch (error) {
      console.error('[useTutorChat] Error saving message:', error);
    }
  }, [loadChatHistory]);

  /**
   * Send a message to Howie
   */
  const sendMessage = useCallback(async (message) => {
    // Validate game state exists
    if (!gameState) {
      setError('Please start a game first');
      return;
    }

    // Validate board
    if (!gameState.board || !Array.isArray(gameState.board) || gameState.board.length !== 9) {
      setError('Invalid game board');
      return;
    }

    // Check if conversation is closed
    if (isConversationClosed) {
      setError('Conversation limit reached. Please start a new conversation.');
      return;
    }

    // Check conversation length
    if (conversationLengthRef.current >= MAX_CONVERSATION_LENGTH) {
      setIsConversationClosed(true);
      setError('Conversation limit reached. Please start a new conversation.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get strategy from strategy selector
      const strategyResponse = await fetch('/api/tutor/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: gameState.board,
          highlightedCell: selectedCell ? { row: selectedCell.row, col: selectedCell.col } : undefined
        })
      });

      if (!strategyResponse.ok) {
        const errorData = await strategyResponse.json();
        throw new Error(errorData.message || 'Failed to get strategy');
      }

      const strategyData = await strategyResponse.json();

      if (strategyData.error) {
        throw new Error(strategyData.message || strategyData.error);
      }

      const strategy = strategyData.strategy;

      // Step 2: Get response from coach
      const coachResponse = await fetch('/api/tutor/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: gameState.board,
          puzzle: gameState.puzzle,
          highlightedCell: selectedCell ? { row: selectedCell.row, col: selectedCell.col } : undefined,
          strategy: strategy,
          chatHistory: chatHistory,
          message: message
        })
      });

      if (!coachResponse.ok) {
        const errorData = await coachResponse.json();
        throw new Error(errorData.message || 'Failed to get coach response');
      }

      const coachData = await coachResponse.json();

      if (coachData.error) {
        throw new Error(coachData.message || coachData.error);
      }

      // Save user message
      await saveMessage('user', message);

      // Save assistant response
      // Note: saveMessage already calls loadChatHistory() which updates
      // conversationLengthRef and checks if conversation should be closed
      await saveMessage('assistant', coachData.response);

    } catch (error) {
      console.error('[useTutorChat] Error sending message:', error);
      setError(error.message || 'Failed to get response from Howie');
    } finally {
      setIsLoading(false);
    }
  }, [gameState, selectedCell, chatHistory, isConversationClosed, saveMessage, loadChatHistory]);

  /**
   * Get help for selected cell (convenience method)
   */
  const getHelpForCell = useCallback(() => {
    if (!selectedCell) {
      setError('Please select a cell first');
      return;
    }
    sendMessage('Get help with this cell');
  }, [selectedCell, sendMessage]);

  return {
    chatHistory,
    isLoading,
    error,
    isConversationClosed,
    conversationCount,
    canStartNewConversation: conversationCount < MAX_CONVERSATIONS_PER_GAME,
    sendMessage,
    getHelpForCell,
    clearChatHistory,
    startNewConversation,
    endConversation,
    setError
  };
}


