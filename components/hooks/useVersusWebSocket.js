import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const INITIAL_RECONNECT_DELAY = 1000; // 1 second initial

/**
 * Hook for managing WebSocket connection in versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Session ID
 * @param {string} playerId - Player ID ('player1' or 'player2')
 * @param {function} onMessage - Callback for WebSocket messages
 * @param {function} onReconnect - Callback to fetch state snapshot on reconnect
 */
export function useVersusWebSocket(roomId, sessionId, playerId, onMessage, onReconnect) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onReconnectRef.current = onReconnect;
  }, [onMessage, onReconnect]);

  const connect = useCallback(() => {
    if (!roomId || !sessionId) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useVersusWebSocket] Connected');
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectAttemptRef.current = 0;

        // Join room - only if we have both roomId and sessionId
        // sessionId must be a real session ID, not a placeholder
        if (roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
          ws.send(JSON.stringify({
            type: 'join',
            roomId,
            sessionId,
            playerId
          }));
        } else {
          console.warn('[useVersusWebSocket] Cannot join room - missing roomId or valid sessionId', { roomId, sessionId });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'joined') {
            // Successfully joined room - forward to message handler to update state
            console.log('[useVersusWebSocket] Joined room:', message.roomId);
            // Forward joined message to handler to update connection status
            if (onMessageRef.current) {
              onMessageRef.current(message);
            }
          } else if (message.type === 'state_update' || 
                     message.type === 'countdown' ||
                     message.type === 'countdown_start' ||
                     message.type === 'countdown_paused' ||
                     message.type === 'countdown_reset' ||
                     message.type === 'game_start' ||
                     message.type === 'notification' ||
                     message.type === 'cell_selected' ||
                     message.type === 'player_connected' ||
                     message.type === 'player_disconnected') {
            // Handle state updates
            if (onMessageRef.current) {
              onMessageRef.current(message);
            }
          } else if (message.type === 'pong') {
            // Heartbeat response
          } else if (message.type === 'error') {
            console.error('[useVersusWebSocket] Error from server:', message.error);
          }
        } catch (error) {
          console.error('[useVersusWebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[useVersusWebSocket] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[useVersusWebSocket] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        // Only reconnect if shouldReconnectRef is true (game hasn't ended, user hasn't left)
        if (shouldReconnectRef.current && roomId && sessionId) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          );
          
          setIsReconnecting(true);
          reconnectAttemptRef.current++;

          reconnectTimeoutRef.current = setTimeout(async () => {
            // Fetch full state snapshot before reconnecting
            if (onReconnectRef.current) {
              try {
                await onReconnectRef.current();
              } catch (error) {
                console.error('[useVersusWebSocket] Error fetching state on reconnect:', error);
              }
            }
            // Only reconnect if still should reconnect and have room/session (with valid sessionId)
            if (shouldReconnectRef.current && roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
              connect();
            } else {
              setIsReconnecting(false);
            }
          }, delay);
        }
      };
    } catch (error) {
      console.error('[useVersusWebSocket] Error creating WebSocket:', error);
      setIsReconnecting(true);
      
      // Retry connection
      const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current && roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
              reconnectAttemptRef.current++;
              connect();
            } else {
              setIsReconnecting(false);
            }
          }, delay);
    }
  }, [roomId, sessionId, playerId]);

  useEffect(() => {
        // Only connect if we have both roomId and a valid sessionId (not placeholder)
        // Add a small delay to ensure room is fully created before connecting
        if (roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
          // Small delay to ensure room is fully saved to Redis
          const connectTimer = setTimeout(() => {
            connect();
          }, 200);
      
      return () => {
        clearTimeout(connectTimer);
        shouldReconnectRef.current = false;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, sessionId, connect]);


  // Send message helper
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    isReconnecting,
    sendMessage
  };
}

