import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing versus player actions (ready, name change)
 * @param {string} roomId - Room ID
 * @param {string} playerId - Player ID
 * @param {object} gameState - Current game state
 * @param {function} loadState - Function to reload game state
 * @param {function} onPlayerNameChange - Optional callback when name changes
 * @returns {object} Action handlers
 */
export function useVersusPlayerActions(roomId, playerId, gameState, loadState, onPlayerNameChange) {
  const isReadyRequestInProgressRef = useRef(false);
  // Use ref to avoid recreating callback when loadState changes
  const loadStateRef = useRef(loadState);
  
  // Keep ref in sync
  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  // Handle ready button click
  const handleReadyClick = useCallback(async () => {
    if (!roomId) return;
    
    // Prevent duplicate clicks while request is in progress
    if (isReadyRequestInProgressRef.current) {
      return;
    }

    // Check current ready status - if already ready, don't make another request
    const currentReady = gameState?.players?.[playerId]?.ready;
    if (currentReady) {
      return;
    }

    // Player 1 cannot start until player 2 has joined
    if (playerId === 'player1' && !gameState?.players?.player2) {
      return;
    }

    isReadyRequestInProgressRef.current = true;

    try {
      const response = await fetch('/api/versus/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          ready: true
        })
      });

      const result = await response.json();

      // API response is just a nudge - fetch authoritative state from Postgres
      // Postgres is the authority, Realtime will notify us of changes
      if (result.success) {
        // Fetch authoritative state from Postgres (will be triggered by broadcasts)
        // The broadcast from the API will trigger a Postgres fetch in useVersusGame
        // No need to update state here - Postgres subscription and broadcasts handle it
      }
    } catch (error) {
      console.error('Error setting ready:', error);
    } finally {
      isReadyRequestInProgressRef.current = false;
    }
  }, [roomId, gameState, playerId]);

  // Handle name change
  const handleNameChange = useCallback(async (newName) => {
    if (!roomId || !playerId) return;

    if (onPlayerNameChange) {
      onPlayerNameChange(newName);
    }

    try {
      const response = await fetch('/api/versus/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name: newName
        })
      });
      
      const result = await response.json();
      
      // Reload state to get updated name
      loadStateRef.current();
    } catch (error) {
      console.error('Error updating name:', error);
    }
  }, [roomId, playerId, onPlayerNameChange]);

  return {
    handleReadyClick,
    handleNameChange
  };
}
