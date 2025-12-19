'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for making a panel draggable
 * @param {Object} initialPosition - Initial position {x, y}
 * @param {Object} size - Panel size {width, height}
 * @param {Function} constrainPosition - Function to constrain position within viewport
 * @returns {Object} Position state and drag handlers
 */
export function useDraggablePanel(initialPosition, size, constrainPosition) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const positionRef = useRef(position);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Keep position ref in sync
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Constrain position when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const constrained = constrainPosition(
          positionRef.current.x,
          positionRef.current.y,
          size.width,
          size.height
        );
        setPosition(constrained);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size.width, size.height, constrainPosition]);

  // Handle drag start
  const handleMouseDown = useCallback((e, headerRef) => {
    if (headerRef?.current && headerRef.current.contains(e.target)) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y
      };
    }
  }, []);

  // Handle drag movement
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => {
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;
        const constrained = constrainPosition(newX, newY, size.width, size.height);
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
  }, [isDragging, size.width, size.height, constrainPosition]);

  return {
    position,
    setPosition,
    isDragging,
    handleMouseDown
  };
}

