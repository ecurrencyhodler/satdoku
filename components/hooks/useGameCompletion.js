import { useCallback } from 'react';
import { getSessionId } from '../../lib/sessionId';

/**
 * Hook for handling game completion saving to the API
 */
export function useGameCompletion(gameStateRef, gameState) {
  const saveCompletion = useCallback(async (stats) => {
    try {
      const sessionId = getSessionId();
      const difficulty = gameStateRef.current?.currentDifficulty || gameState?.difficulty || 'beginner';
      
      if (sessionId) {
        const response = await fetch('/api/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            score: stats.score ?? 0,
            difficulty,
            mistakes: stats.mistakes ?? 0,
          }),
        });
        
        if (!response.ok) {
          console.error('[useGameCompletion] Failed to save completion:', await response.text());
        }
      }
    } catch (error) {
      console.error('[useGameCompletion] Error saving completion:', error);
    }
  }, [gameStateRef, gameState]);

  return { saveCompletion };
}
