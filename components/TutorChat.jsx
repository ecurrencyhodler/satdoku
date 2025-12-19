'use client';

import { useState, useRef, useEffect } from 'react';
import { useCheckout } from '@moneydevkit/nextjs';
import { useTutorChat } from './hooks/useTutorChat';
import { useDraggablePanel } from './hooks/useDraggablePanel';
import { useResizablePanel } from './hooks/useResizablePanel';
import TutorChatMessage from './TutorChatMessage';
import { HOWIE_CHAT_PAYMENT } from '../src/js/system/constants.js';

export default function TutorChat({ gameState, selectedCell }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const chatPanelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const headerRef = useRef(null);
  const textareaRef = useRef(null);

  // Helper function to calculate middle-right position
  const getMiddleRightPosition = (width, height) => {
    if (typeof window !== 'undefined') {
      return {
        x: window.innerWidth - width - 20,
        y: (window.innerHeight - height) / 2
      };
    }
    return { x: 0, y: 0 };
  };

  // Helper function to constrain position within viewport
  const constrainPosition = (x, y, width, height) => {
    if (typeof window === 'undefined') return { x, y };

    const maxX = window.innerWidth - width;
    const maxY = window.innerHeight - height;

    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  };

  // Track if chat was just opened to set initial position
  const justOpenedRef = useRef(false);

  // Initial size and position
  const initialSize = { width: 400, height: 500 };
  const initialPosition = { x: 0, y: 0 };

  // Use draggable panel hook (must be first to get setPosition)
  const { position, setPosition, isDragging, handleMouseDown: handleDragMouseDown } = useDraggablePanel(
    initialPosition,
    initialSize,
    constrainPosition
  );

  // Use resizable panel hook
  const { size, setSize, isResizing, resizeCorner, handleResizeStart } = useResizablePanel(
    initialSize,
    position,
    constrainPosition,
    setPosition
  );

  const {
    chatHistory,
    isLoading,
    error,
    isConversationClosed,
    conversationCount,
    requiresPayment,
    paidConversationsCount,
    canStartNewConversation,
    sendMessage,
    startNewConversation,
    endConversation,
    reloadChatHistory,
    setError
  } = useTutorChat(gameState, selectedCell);

  const { navigate, isNavigating } = useCheckout();

  // Compute whether payment button should be shown
  // Show payment button if:
  // 1. Payment is required (normal case), OR
  // 2. Conversation is closed and next conversation will require payment
  const shouldShowPaymentButton = requiresPayment ||
    (isConversationClosed && conversationCount > 0 && conversationCount > paidConversationsCount);

  // Track previous isOpen state to detect when chat opens
  const prevIsOpenRef = useRef(false);

  // Scroll to bottom when chat opens or new messages arrive
  useEffect(() => {
    if (isOpen) {
      const isOpening = !prevIsOpenRef.current;
      prevIsOpenRef.current = isOpen;
      
      if (isOpening) {
        // When opening, set scroll position immediately using requestAnimationFrame
        // This happens after render but before paint, preventing visible jump
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
      } else if (messagesEndRef.current) {
        // For new messages, use smooth scroll
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      prevIsOpenRef.current = isOpen;
    }
  }, [isOpen, chatHistory?.length ?? 0]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Focus textarea when chat modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure the DOM has rendered the textarea
      const timeoutId = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Focus textarea after Howie responds
  useEffect(() => {
    if (!isLoading && textareaRef.current && isOpen) {
      // Small delay to ensure the message has been rendered
      const timeoutId = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // If payment is required, trigger payment instead of sending message
    if (shouldShowPaymentButton) {
      handlePayment();
      return;
    }

    if (!inputValue.trim() || isLoading || isConversationClosed) return;

    await sendMessage(inputValue.trim());
    setInputValue('');
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    endConversation();
  };

  const handleHowieClick = async () => {
    if (!gameState) {
      setError('Please start a game first');
      return;
    }

    // If modal is already open, close it
    if (isOpen) {
      handleClose();
      return;
    }

    // Always try to start a conversation first
    // The API will tell us if payment is actually required
    const started = await startNewConversation();

    if (!started) {
      // Failed to start - check if it's because payment is required
      // If so, open chat panel to show payment button
      if (requiresPayment) {
        justOpenedRef.current = true;
        const initialPos = getMiddleRightPosition(size.width, size.height);
        setPosition(initialPos);
        setIsOpen(true);
      }
      return;
    }

    // Successfully started conversation - open chat panel
    justOpenedRef.current = true;
    const initialPos = getMiddleRightPosition(size.width, size.height);
    setPosition(initialPos);
    setIsOpen(true);
  };

  const handlePayment = () => {
    navigate({
      title: 'Satdoku',
      description: 'Unlock Howie chat conversation',
      amount: HOWIE_CHAT_PAYMENT,
      currency: 'SAT',
      metadata: {
        type: 'tutor_chat_payment',
        gameVersion: gameState?.version,
        successUrl: '/purchase-success?checkout-id={CHECKOUT_ID}&type=tutor_chat',
      },
    });
  };

  // Set position when chat first opens
  useEffect(() => {
    if (isOpen && justOpenedRef.current) {
      const initialPos = getMiddleRightPosition(size.width, size.height);
      setPosition(initialPos);
      justOpenedRef.current = false;
    }
  }, [isOpen, size.width, size.height]);

  // Auto-open chat if redirected from payment success
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const tutorChatOpen = urlParams.get('tutor_chat_open');

    if (tutorChatOpen === 'true' && !isOpen && gameState) {
      // Reload chat history first to get updated payment status after payment
      reloadChatHistory().then(() => {
        // Then start conversation and open chat
        startNewConversation().then((started) => {
          if (started) {
            justOpenedRef.current = true;
            const initialPos = getMiddleRightPosition(size.width, size.height);
            setPosition(initialPos);
            setIsOpen(true);
          }
        });
      });
      // Remove query param from URL
      urlParams.delete('tutor_chat_open');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [gameState, isOpen, startNewConversation, reloadChatHistory]);

  return (
    <>
      {/* Howie Logo/Avatar - Fixed at bottom center */}
      <div
        className="howie-logo"
        onClick={handleHowieClick}
        title={
          !gameState
            ? 'Start a game to get help from Howie'
            : `Click to chat with Howie${conversationCount > 0 ? ` (${conversationCount} conversation${conversationCount !== 1 ? 's' : ''} used)` : ''}`
        }
      >
        <img src="/howie.svg" alt="Howie" className="howie-avatar" />
      </div>

      {/* Chat Panel - Draggable and Resizable */}
      {isOpen && (
        <div
          ref={chatPanelRef}
          className="tutor-chat-panel"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`
          }}
        >
          {/* Header - Draggable */}
          <div
            ref={headerRef}
            className="tutor-chat-header"
            onMouseDown={(e) => handleDragMouseDown(e, headerRef)}
          >
            <div className="tutor-chat-header-title">
              <img src="/howie.svg" alt="Howie" className="howie-avatar-small" />
              <span>Howie - Your Sudoku Mentor</span>
            </div>
            <button
              className="tutor-chat-close-btn"
              onClick={handleClose}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Messages Area */}
          <div ref={messagesContainerRef} className="tutor-chat-messages">
            {chatHistory.length === 0 && (
              <TutorChatMessage
                role="assistant"
                content="Hi! I'm Howie. I teach players how to solve Sudoku puzzles. Ask me up to 5 questions."
              />
            )}
            {chatHistory.map((msg, index) => (
              <TutorChatMessage
                key={index}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {isLoading && (
              <div className="tutor-chat-message tutor-chat-message-assistant">
                <div className="tutor-chat-message-content">
                  <span className="tutor-chat-typing">Howie is thinking...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="tutor-chat-error">
                {error}
                <button onClick={() => setError(null)}>×</button>
              </div>
            )}
            {isConversationClosed && (
              <div className="tutor-chat-closed">
                <p>This conversation has reached its 5 message limit.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="tutor-chat-input-area">
            <form onSubmit={handleSubmit} className="tutor-chat-form">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  shouldShowPaymentButton
                    ? "Pay 100 sats to chat again 👉"
                    : isConversationClosed
                    ? "Conversation closed"
                    : "Ask Howie a question..."
                }
                disabled={shouldShowPaymentButton || isLoading || isConversationClosed || !gameState}
                className="tutor-chat-input"
                rows={1}
              />
              <button
                type="submit"
                disabled={
                  shouldShowPaymentButton
                    ? isNavigating
                    : isLoading || isConversationClosed || !gameState
                }
                className={`tutor-chat-send-btn ${shouldShowPaymentButton ? 'tutor-chat-send-btn-payment' : ''}`}
              >
                {shouldShowPaymentButton
                  ? (
                    isNavigating ? (
                      <span className="tutor-chat-spinner-container">
                        <span className="tutor-chat-spinner"></span>
                      </span>
                    ) : (
                      `${HOWIE_CHAT_PAYMENT} sats`
                    )
                  )
                  : 'Send'
                }
              </button>
            </form>
          </div>

          {/* Resize Handles - Bottom Corners */}
          <div
            className="tutor-chat-resize-handle tutor-chat-resize-handle-bottom-left"
            onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
          />
          <div
            className="tutor-chat-resize-handle tutor-chat-resize-handle-bottom-right"
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
          />
        </div>
      )}
    </>
  );
}


