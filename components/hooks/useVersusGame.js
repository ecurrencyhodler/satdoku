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
        setGameState(data.state);
        setError(null);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusGame.js:40',message:'state load failed',data:{error:data.error,roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusGame.js:137',message:'player connection status change message',data:{type:message.type,playerId:message.playerId,sessionId:message.sessionId,roomId,isLoading:isLoadingRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Reload state to get updated connection status
      // Only reload if we have a roomId and aren't already loading
      if (roomId && !isLoadingRef.current) {
        // For player_connected, add a small delay to ensure database update has completed
        if (message.type === 'player_connected') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusGame.js:144',message:'scheduling state reload for player_connected',data:{playerId:message.playerId,roomId,delay:100},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setTimeout(() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusGame.js:147',message:'executing state reload for player_connected',data:{playerId:message.playerId,roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            loadStateRef.current();
          }, 100); // 100ms delay to allow database update to complete
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusGame.js:151',message:'executing immediate state reload for player_disconnected',data:{playerId:message.playerId,roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          loadStateRef.current();
        }
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

