'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChatHistory } from './useChatHistory.js';
import { useConversationTracking } from './useConversationTracking.js';

/**
 * Custom hook for tutor chat functionality
 * Orchestrates chat history, conversation tracking, and message sending
 */
export function useTutorChat(gameState, selectedCell) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chat history management
  const {
    chatHistory,
    loadChatHistory,
    saveMessage,
    clearChatHistory
  } = useChatHistory();

  // Conversation tracking
  const {
    conversationCount,
    requiresPayment,
    paidConversationsCount,
    isConversationClosed,
    canStartNewConversation,
    conversationLengthRef,
    userMessageCountRef,
    startNewConversation: startNewConversationTracking,
    endConversation,
    resetConversation,
    updatePaymentStatus,
    incrementUserMessageCount
  } = useConversationTracking(chatHistory, loadChatHistory);

  // Load chat history and conversation count on mount
  useEffect(() => {
    loadChatHistory().then((data) => {
      if (data.success) {
        updatePaymentStatus(data);
      }
    });
  }, []);

  // Reset conversation when game state changes (new game)
  useEffect(() => {
    if (gameState) {
      resetConversation();
      // Clear chat history when new game starts
      clearChatHistory();
    }
  }, [gameState?.version]); // Reset when game version changes (new game)

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(async () => {
    const result = await startNewConversationTracking();
    if (result.success) {
      setError(null);
      return true;
    } else {
      // Don't show error message when payment is required
      if (!result.requiresPayment && result.error) {
        setError(result.error);
      } else {
        setError(null);
      }
      return false;
    }
  }, [startNewConversationTracking]);

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
    if (conversationLengthRef.current >= 5) {
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
      incrementUserMessageCount();

      // Save assistant response
      await saveMessage('assistant', coachData.response);

    } catch (error) {
      console.error('[useTutorChat] Error sending message:', error);
      setError(error.message || 'Failed to get response from Howie');
    } finally {
      setIsLoading(false);
    }
  }, [gameState, selectedCell, chatHistory, isConversationClosed, saveMessage, conversationLengthRef, incrementUserMessageCount]);

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
    requiresPayment,
    paidConversationsCount,
    canStartNewConversation,
    sendMessage,
    getHelpForCell,
    clearChatHistory,
    startNewConversation,
    endConversation,
    setError
  };
}


