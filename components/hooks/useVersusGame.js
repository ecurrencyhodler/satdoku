import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing versus game state
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Session ID
 * @param {string} playerId - Player ID
 * @param {boolean} enableInitialLoad - Whether to load state immediately on mount (default: true)
 */
export function useVersusGame(roomId, sessionId, playerId, enableInitialLoad = true) {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(enableInitialLoad);
  const [error, setError] = useState(null);
  const isLoadingRef = useRef(false);
  // Track if we've already loaded for this roomId to prevent multiple loads
  const hasLoadedForRoomRef = useRef(null);

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

  // Use a ref to store loadState to avoid dependency issues
  const loadStateRef = useRef(loadState);
  loadStateRef.current = loadState;

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
      // Only reload if we have a roomId and aren't already loading
      if (roomId && !isLoadingRef.current) {
        loadStateRef.current();
      }
    } else if (message.type === 'notification') {
      // Handle notifications - state update is in message.room
      if (message.room) {
        const clientState = transformVersusStateToClient(message.room, playerId);
        setGameState(clientState);
      }
      // Return notification to parent component
      return message.notification;
    } else if (message.type === 'cell_selected') {
      // Update opponent's selected cell (only if it's from the opponent, not ourselves)
      if (message.playerId !== playerId) {
        setGameState(prev => prev ? {
          ...prev,
          opponentSelectedCell: message.selectedCell
        } : null);
      }
    }
  }, [playerId, roomId]);

  // Initial load (only if enabled)
  // Track the previous roomId to detect changes - initialize to null to detect first roomId
  const prevRoomIdRef = useRef(null);
  
  useEffect(() => {
    // Reset hasLoadedForRoomRef when roomId actually changes to a different room
    // Only reset if roomId changed from one non-null value to another
    const roomIdChanged = prevRoomIdRef.current !== null && prevRoomIdRef.current !== roomId && roomId !== null;
    if (roomIdChanged) {
      hasLoadedForRoomRef.current = null;
    }
    // Update prevRoomIdRef to current roomId (even if null)
    prevRoomIdRef.current = roomId;
    
    // Check if we've already loaded for this room - if so, never load again
    const alreadyLoaded = hasLoadedForRoomRef.current === roomId;
    
    // Only load if enabled, we have a roomId, and we haven't already loaded for this room
    // Once we've loaded for a room, never load again (even if enableInitialLoad toggles)
    if (roomId && enableInitialLoad && !alreadyLoaded) {
      // Set the ref IMMEDIATELY and SYNCHRONOUSLY to prevent duplicate calls
      // This must happen before calling loadState
      hasLoadedForRoomRef.current = roomId;
      loadStateRef.current();
    } else if (roomId && !enableInitialLoad) {
      // If initial load is disabled, set loading to false so component can render
      setLoading(false);
    }
  }, [roomId, enableInitialLoad]);

  return {
    gameState,
    loading,
    error,
    loadState,
    handleWebSocketMessage,
    setGameState
  };
}

