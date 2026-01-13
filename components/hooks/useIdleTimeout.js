import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to detect user inactivity and trigger a callback after a timeout
 * @param {function} onIdle - Callback to execute when user becomes idle
 * @param {number} timeout - Timeout duration in milliseconds (default: 1 hour)
 * @param {boolean} enabled - Whether the idle detection is enabled (default: true)
 * @returns {object} { resetIdleTimer, isIdle }
 */
export function useIdleTimeout(onIdle, timeout = 60 * 60 * 1000, enabled = true) {
  const timeoutRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  const isIdleRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  // Reset the idle timer
  const resetIdleTimer = useCallback(() => {
    if (!enabled) return;
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Mark as not idle
    isIdleRef.current = false;

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      if (onIdleRef.current) {
        onIdleRef.current();
      }
    }, timeout);
  }, [timeout, enabled]);

  useEffect(() => {
    if (!enabled) {
      // Clear timeout if disabled
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Activity events to listen for
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'touchmove',
      'scroll',
      'wheel',
      'click',
      'focus'
    ];

    // Throttled activity handler to prevent excessive resets
    let lastActivity = Date.now();
    const THROTTLE_MS = 1000; // Only reset timer at most once per second

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity >= THROTTLE_MS) {
        lastActivity = now;
        resetIdleTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also listen for visibility change - reset when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetIdleTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start the initial timer
    resetIdleTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, resetIdleTimer]);

  return {
    resetIdleTimer,
    isIdle: isIdleRef.current
  };
}
