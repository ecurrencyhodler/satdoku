import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing versus game state
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Session ID
 * @param {string} playerId - Player ID
 */
export function useVersusGame(roomId, sessionId, playerId) {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isLoadingRef = useRef(false);
  // Track if we've already loaded for this roomId to prevent multiple loads
  const hasLoadedForRoomRef = useRef(null);

  // Load initial state
  const loadState = useCallback(async () => {
    console.log('[useVersusGame] loadState called, roomId:', roomId, 'isLoading:', isLoadingRef.current);
    if (!roomId || isLoadingRef.current) {
      console.log('[useVersusGame] loadState early return - no roomId or already loading');
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log('[useVersusGame] Fetching state from /api/versus/state?room=' + roomId);
      
      const response = await fetch(`/api/versus/state?room=${roomId}`);
      const data = await response.json();

      if (data.success && data.state) {
        console.log('[useVersusGame] State loaded successfully, status:', data.state.status, 'start_at:', data.state.start_at);
        // Note: opponentSelectedCell is now tracked via presence, not in gameState
        setGameState(data.state);
        setError(null);
      } else {
        console.error('[useVersusGame] Failed to load state:', data.error);
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
    console.log('[useVersusGame] handleWebSocketMessage:', message.type, message);
    const { transformVersusStateToClient } = await import('../../lib/game/versusGameStateClient.js');
    
    // Handle direct room update from versus_rooms table (Postgres subscription)
    // This is authoritative, but we fetch full state to ensure we have board data too
    if (message.type === 'room_update') {
      console.log('[useVersusGame] room_update received, start_at in payload:', message.room?.start_at);
      // Fetch full authoritative state from Postgres (includes board data)
      if (roomId && !isLoadingRef.current) {
        console.log('[useVersusGame] Triggering loadState from room_update');
        loadStateRef.current();
      }
    } else if (message.type === 'state_update') {
      // Broadcast is just a nudge - fetch full state from Postgres (the authority)
      // Only update ephemeral UI data from broadcast if present
      if (message.scoreDelta || message.modals || message.notification) {
        // Update ephemeral UI data immediately, but fetch authoritative state
        setGameState(prev => prev ? {
          ...prev,
          // Preserve ephemeral UI data from broadcast
          ...(message.scoreDelta && { lastScoreDelta: message.scoreDelta }),
          ...(message.modals && { lastModals: message.modals }),
          ...(message.notification && { lastNotification: message.notification })
        } : null);
      }
      // Fetch authoritative state from Postgres
      if (roomId && !isLoadingRef.current) {
        loadStateRef.current();
      }
    } else if (message.type === 'countdown' || message.type === 'countdown_start') {
      // countdown_start is a nudge - fetch full state from Postgres
      // start_at comes from Postgres subscription (room_update event)
      if (message.type === 'countdown_start') {
        // Fetch authoritative state from Postgres
        if (roomId && !isLoadingRef.current) {
          loadStateRef.current();
        }
      } else {
        // Regular countdown update - ephemeral UI data, update immediately
        setGameState(prev => {
          return prev ? {
            ...prev,
            gameStatus: 'countdown',
            countdown: message.countdown
          } : null;
        });
      }
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
      setGameState(prev => {
        return prev ? {
          ...prev,
          gameStatus: 'playing',
          countdown: 0
        } : null;
      });
    } else if (message.type === 'joined') {
      // WebSocket join confirmed - fetch authoritative state from Postgres
      if (roomId && !isLoadingRef.current) {
        loadStateRef.current();
      }
    } else if (message.type === 'player_connected' || message.type === 'player_disconnected') {
      // Presence event = "go refetch" from Postgres
      // No delays, no DB writes - just trigger state reload
      // Presence is ephemeral connection truth, Postgres is durable game truth
      if (roomId && !isLoadingRef.current) {
        loadStateRef.current();
      }
    } else if (message.type === 'notification') {
      // Notification received - fetch authoritative state from Postgres
      // Store notification for parent component
      if (message.notification) {
        setGameState(prev => prev ? {
          ...prev,
          lastNotification: message.notification
        } : null);
      }
      // Fetch authoritative state from Postgres
      if (roomId && !isLoadingRef.current) {
        loadStateRef.current();
      }
      // Return notification to parent component
      return message.notification;
    }
    // Note: cell_selected messages are no longer used - cell selection is now tracked via presence
  }, [playerId, roomId]);

  // Initial load when roomId exists
  // Track the previous roomId to detect changes
  const prevRoomIdRef = useRef(null);
  
  useEffect(() => {
    // Reset hasLoadedForRoomRef when roomId actually changes to a different room
    const roomIdChanged = prevRoomIdRef.current !== null && prevRoomIdRef.current !== roomId && roomId !== null;
    if (roomIdChanged) {
      hasLoadedForRoomRef.current = null;
    }
    // Update prevRoomIdRef to current roomId (even if null)
    prevRoomIdRef.current = roomId;
    
    // Check if we've already loaded for this room - if so, don't load again
    const alreadyLoaded = hasLoadedForRoomRef.current === roomId;
    
    // Load state when roomId exists and we haven't loaded for this room yet
    if (roomId && !alreadyLoaded) {
      hasLoadedForRoomRef.current = roomId;
      loadStateRef.current();
    } else if (!roomId) {
      // No roomId - clear state and stop loading
      setGameState(null);
      setLoading(false);
    }
  }, [roomId]);

  return {
    gameState,
    loading,
    error,
    loadState,
    handleWebSocketMessage,
    setGameState
  };
}

