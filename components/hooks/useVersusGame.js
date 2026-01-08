import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing versus game state
 */
export function useVersusGame(roomId, sessionId, playerId) {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isLoadingRef = useRef(false);

  // Load initial state
  const loadState = useCallback(async () => {
    if (!roomId || isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      
      const response = await fetch(`/api/versus/state?room=${roomId}`);
      const data = await response.json();

      if (data.success && data.state) {
        setGameState(data.state);
        setError(null);
      } else {
        setError(data.error || 'Failed to load game state');
      }
    } catch (err) {
      console.error('[useVersusGame] Error loading state:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [roomId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(async (message) => {
    const { transformVersusStateToClient } = await import('../../lib/game/versusGameStateClient.js');
    
    if (message.type === 'state_update' && message.room) {
      const clientState = transformVersusStateToClient(message.room, playerId);
      setGameState(clientState);
    } else if (message.type === 'countdown' || message.type === 'countdown_start') {
      // Update countdown in state
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'countdown',
        countdown: message.countdown
      } : null);
    } else if (message.type === 'countdown_paused') {
      // Reset to waiting if countdown paused
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'waiting',
        countdown: 0
      } : null);
    } else if (message.type === 'countdown_reset') {
      // Reset countdown and ready status if both players disconnected
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'waiting',
        countdown: 0,
        players: {
          ...prev.players,
          player1: { ...prev.players.player1, ready: false },
          player2: { ...prev.players.player2, ready: false }
        }
      } : null);
    } else if (message.type === 'game_start') {
      // Game started
      setGameState(prev => prev ? {
        ...prev,
        gameStatus: 'playing',
        countdown: 0
      } : null);
    } else if (message.type === 'joined' && message.room) {
      // Update state when WebSocket join is confirmed (includes connection status)
      const clientState = transformVersusStateToClient(message.room, playerId);
      setGameState(clientState);
    } else if (message.type === 'player_connected' || message.type === 'player_disconnected') {
      // Reload state to get updated connection status
      loadState();
    } else if (message.type === 'notification') {
      // Handle notifications - state update is in message.room
      if (message.room) {
        const clientState = transformVersusStateToClient(message.room, playerId);
        setGameState(clientState);
      }
      // Return notification to parent component
      return message.notification;
    } else if (message.type === 'cell_selected') {
      // Update opponent's selected cell
      setGameState(prev => prev ? {
        ...prev,
        opponentSelectedCell: message.selectedCell
      } : null);
    }
  }, [playerId, loadState]);

  // Initial load
  useEffect(() => {
    if (roomId) {
      loadState();
    }
  }, [roomId, loadState]);

  return {
    gameState,
    loading,
    error,
    loadState,
    handleWebSocketMessage,
    setGameState
  };
}

