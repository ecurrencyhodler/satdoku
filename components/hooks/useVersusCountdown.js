import { useState, useEffect } from 'react';

/**
 * Hook for client-side countdown derived from start_at timestamp
 * @param {string|null} startAt - ISO timestamp string for when game starts
 * @returns {object} { countdown: number, isActive: boolean }
 */
export function useVersusCountdown(startAt) {
  const [countdown, setCountdown] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!startAt) {
      setCountdown(0);
      setIsActive(false);
      return;
    }

    const updateCountdown = () => {
      const startTime = new Date(startAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((startTime - now) / 1000));
      setCountdown(diff);
      setIsActive(now >= startTime);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [startAt]);

  return { countdown, isActive };
}
