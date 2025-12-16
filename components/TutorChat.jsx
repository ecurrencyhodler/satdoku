'use client';

import { useState, useRef, useEffect } from 'react';
import { useTutorChat } from './hooks/useTutorChat';
import TutorChatMessage from './TutorChatMessage';

export default function TutorChat({ gameState, selectedCell }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  // Initialize position to center-right of screen
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        x: window.innerWidth - 450,
        y: 50
      };
    }
    return { x: 0, y: 0 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState(null); // 'bottom-left' or 'bottom-right'
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0 });
  
  const chatPanelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const headerRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    chatHistory,
    isLoading,
    error,
    isConversationClosed,
    sendMessage,
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
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
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
  }, [isDragging, dragStart]);

  // Handle resize
  const handleResizeStart = (e, corner) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      left: position.x
    });
  };

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e) => {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        if (resizeCorner === 'bottom-right') {
          // Resize from bottom-right corner
          const newWidth = Math.max(300, Math.min(800, resizeStart.width + deltaX));
          const newHeight = Math.max(300, Math.min(800, resizeStart.height + deltaY));
          setSize({ width: newWidth, height: newHeight });
        } else if (resizeCorner === 'bottom-left') {
          // Resize from bottom-left corner
          const newWidth = Math.max(300, Math.min(800, resizeStart.width - deltaX));
          const newHeight = Math.max(300, Math.min(800, resizeStart.height + deltaY));
          const newLeft = Math.min(resizeStart.left + deltaX, resizeStart.left + resizeStart.width - 300);
          setSize({ width: newWidth, height: newHeight });
          setPosition({ ...position, x: newLeft });
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
  }, [isResizing, resizeCorner, resizeStart, size, position]);

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
  };

  const handleHowieClick = () => {
    if (!gameState) {
      setError('Please start a game first');
      return;
    }
    setIsOpen(true);
  };

  const isDisabled = !gameState || isConversationClosed;

  return (
    <>
      {/* Howie Logo/Avatar - Fixed at bottom center */}
      <div 
        className={`howie-logo ${isDisabled ? 'howie-logo-disabled' : ''}`}
        onClick={handleHowieClick}
        title={isDisabled ? 'Start a game to get help from Howie' : 'Click to chat with Howie'}
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
              <span>Howie - Your Sudoku Tutor</span>
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
                content="Hi! I'm Howie. I'll teach you how to play Sudoku. Ask me a question!"
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
                <p>Conversation limit reached. Start a new game to chat again!</p>
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
