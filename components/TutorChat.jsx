'use client';

import { useState, useRef, useEffect } from 'react';
import { useTutorChat } from './hooks/useTutorChat';
import TutorChatMessage from './TutorChatMessage';

const MAX_CONVERSATIONS_PER_GAME = 5;

export default function TutorChat({ gameState, selectedCell }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState(null); // 'bottom-left' or 'bottom-right'
  
  const chatPanelRef = useRef(null);
  const messagesEndRef = useRef(null);
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

  // Keep panel within viewport when window is resized
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0 });
  
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    const handleResize = () => {
      if (isOpen && typeof window !== 'undefined') {
        const constrained = constrainPosition(
          positionRef.current.x, 
          positionRef.current.y, 
          sizeRef.current.width, 
          sizeRef.current.height
        );
        setPosition(constrained);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const {
    chatHistory,
    isLoading,
    error,
    isConversationClosed,
    conversationCount,
    canStartNewConversation,
    sendMessage,
    startNewConversation,
    endConversation,
    setError
  } = useTutorChat(gameState, selectedCell);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Handle drag
  const handleMouseDown = (e) => {
    if (headerRef.current && headerRef.current.contains(e.target)) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y
      };
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => {
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;
        const constrained = constrainPosition(newX, newY, sizeRef.current.width, sizeRef.current.height);
        setPosition(constrained);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Handle resize
  const handleResizeStart = (e, corner) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeCorner(corner);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      left: positionRef.current.x,
      top: positionRef.current.y
    };
  };

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e) => {
        const resizeStart = resizeStartRef.current;
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        if (resizeCorner === 'bottom-right') {
          // Resize from bottom-right corner
          const maxWidth = typeof window !== 'undefined' ? window.innerWidth - resizeStart.left : 800;
          const maxHeight = typeof window !== 'undefined' ? window.innerHeight - resizeStart.y : 800;
          const newWidth = Math.max(300, Math.min(800, Math.min(resizeStart.width + deltaX, maxWidth)));
          const newHeight = Math.max(300, Math.min(800, Math.min(resizeStart.height + deltaY, maxHeight)));
          setSize({ width: newWidth, height: newHeight });
        } else if (resizeCorner === 'bottom-left') {
          // Resize from bottom-left corner
          const maxWidth = typeof window !== 'undefined' ? resizeStart.left + resizeStart.width : 800;
          const maxHeight = typeof window !== 'undefined' ? window.innerHeight - resizeStart.top : 800;
          const newWidth = Math.max(300, Math.min(800, Math.min(resizeStart.width - deltaX, maxWidth)));
          const newHeight = Math.max(300, Math.min(800, Math.min(resizeStart.height + deltaY, maxHeight)));
          const newLeft = resizeStart.left + (resizeStart.width - newWidth);
          const constrained = constrainPosition(newLeft, resizeStart.top, newWidth, newHeight);
          setSize({ width: newWidth, height: newHeight });
          setPosition(constrained);
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        setResizeCorner(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, resizeCorner]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    
    // If modal is already open, do nothing
    if (isOpen) {
      return;
    }
    
    // Start a new conversation when opening modal
    const started = await startNewConversation();
    if (!started) {
      // Failed to start conversation (e.g., max reached)
      return;
    }
    
    // Reset position to middle-right when opening
    justOpenedRef.current = true;
    const initialPos = getMiddleRightPosition(size.width, size.height);
    setPosition(initialPos);
    setIsOpen(true);
  };

  // Set position when chat first opens
  useEffect(() => {
    if (isOpen && justOpenedRef.current) {
      const initialPos = getMiddleRightPosition(size.width, size.height);
      setPosition(initialPos);
      justOpenedRef.current = false;
    }
  }, [isOpen, size.width, size.height]);

  const isDisabled = !gameState || !canStartNewConversation;

  return (
    <>
      {/* Howie Logo/Avatar - Fixed at bottom center */}
      <div 
        className={`howie-logo ${isDisabled ? 'howie-logo-disabled' : ''}`}
        onClick={handleHowieClick}
        title={
          !gameState 
            ? 'Start a game to get help from Howie' 
            : !canStartNewConversation
            ? `You've used all ${conversationCount} conversations. Start a new game to chat again!`
            : `Click to chat with Howie (${conversationCount}/${MAX_CONVERSATIONS_PER_GAME} conversations used)`
        }
      >
        <img src="/howie.svg" alt="Howie" className="howie-avatar" />
        <div className="howie-name">Howie</div>
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
            onMouseDown={handleMouseDown}
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
          <div className="tutor-chat-messages">
            {chatHistory.length === 0 && (
              <TutorChatMessage
                role="assistant"
                content="Hi! I'm Howie. I'll teach you how to solve Sudoku puzzles. Ask me a question!"
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
                <p>This conversation has reached its limit. Close and reopen to start a new conversation!</p>
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
                placeholder={isConversationClosed ? "Conversation closed" : "Ask Howie a question..."}
                disabled={isLoading || isConversationClosed || !gameState}
                className="tutor-chat-input"
                rows={1}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || isConversationClosed || !gameState}
                className="tutor-chat-send-btn"
              >
                Send
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
