'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for making a panel resizable
 * @param {Object} initialSize - Initial size {width, height}
 * @param {Object} position - Panel position {x, y}
 * @param {Function} constrainPosition - Function to constrain position within viewport
 * @param {Function} setPosition - Function to update position (needed for bottom-left resize)
 * @returns {Object} Size state and resize handlers
 */
export function useResizablePanel(initialSize, position, constrainPosition, setPosition) {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState(null); // 'bottom-left' or 'bottom-right'

  const sizeRef = useRef(size);
  const positionRef = useRef(position);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });

  // Keep refs in sync
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Handle resize start
  const handleResizeStart = useCallback((e, corner) => {
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
  }, []);

  // Handle resize movement
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
          if (setPosition) {
            setPosition(constrained);
          }
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
  }, [isResizing, resizeCorner, constrainPosition]);

  return {
    size,
    setSize,
    isResizing,
    resizeCorner,
    handleResizeStart
  };
}




