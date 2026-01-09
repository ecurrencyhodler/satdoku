import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client-browser.js';

/**
 * Hook for managing Supabase Realtime connection in versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Session ID
 * @param {string} playerId - Player ID ('player1' or 'player2')
 * @param {function} onMessage - Callback for Realtime messages
 * @param {function} onReconnect - Callback to fetch state snapshot on reconnect
 */
export function useVersusWebSocket(roomId, sessionId, playerId, onMessage, onReconnect) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const channelRef = useRef(null);
  const supabaseRef = useRef(null);
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
    if (!roomId || !sessionId) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      supabaseRef.current = supabase;

      // Create channel for this room
      const channel = supabase.channel(`room:${roomId}`)
        // Subscribe to broadcast messages (postgres_changes)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'versus_messages',
          filter: `room_id=eq.${roomId}`
        }, async (payload) => {
          // Handle broadcast message
          const message = payload.new.message;
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
          
          // Delete message after processing (fire and forget)
          // Using WHERE id = $1 is idempotent - safe if multiple clients process same message
          supabase
            .from('versus_messages')
            .delete()
            .eq('id', payload.new.id)
            .then(() => {})
            .catch(err => console.warn('[useVersusWebSocket] Failed to delete message:', err));
        })
        // Track presence (set up handlers before tracking)
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          // Update connection status from presence
          // presenceState format: { [sessionId]: [{ playerId, sessionId }] }
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'presence_sync',
              presenceState
            });
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          // Player joined (key is sessionId)
          // newPresences contains [{ playerId, sessionId }]
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'player_connected',
              sessionId: key,
              playerId: newPresences[0]?.playerId
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          // Player left (key is sessionId)
          // leftPresences contains [{ playerId, sessionId }]
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'player_disconnected',
              sessionId: key,
              playerId: leftPresences[0]?.playerId
            });
          }
        })
        // Track own presence (must be called before subscribe)
        .track({
          playerId: playerId,
          sessionId: sessionId
        })
        // Subscribe to channel (activates both postgres_changes and presence)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[useVersusWebSocket] Connected to room:', roomId);
            setIsConnected(true);
            setIsReconnecting(false);
            reconnectAttemptRef.current = 0;
            
            // Send joined message to handler
            if (onMessageRef.current) {
              onMessageRef.current({
                type: 'joined',
                roomId
              });
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.log('[useVersusWebSocket] Channel error or closed:', status);
            setIsConnected(false);
            
            // Attempt reconnection
            if (shouldReconnectRef.current && roomId && sessionId) {
              const delay = Math.min(
                1000 * Math.pow(2, reconnectAttemptRef.current),
                30000 // 30 seconds max
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
                // Only reconnect if still should reconnect
                if (shouldReconnectRef.current && roomId && sessionId) {
                  connect();
                } else {
                  setIsReconnecting(false);
                }
              }, delay);
            }
          }
        });

      channelRef.current = channel;
    } catch (error) {
      console.error('[useVersusWebSocket] Error creating Realtime connection:', error);
      setIsReconnecting(true);
      
      // Retry connection
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        30000
      );
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnectRef.current && roomId && sessionId) {
          reconnectAttemptRef.current++;
          connect();
        } else {
          setIsReconnecting(false);
        }
      }, delay);
    }
  }, [roomId, sessionId, playerId]);

  useEffect(() => {
    // Only connect if we have both roomId and a valid sessionId
    if (roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
      // Delay for player2 to ensure room update from API join has propagated
      const delay = playerId === 'player2' ? 800 : 200;
      const connectTimer = setTimeout(() => {
        connect();
      }, delay);
      
      return () => {
        clearTimeout(connectTimer);
        shouldReconnectRef.current = false;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (channelRef.current) {
          channelRef.current.unsubscribe();
          channelRef.current.untrack();
          channelRef.current = null;
        }
      };
    }

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.untrack();
        channelRef.current = null;
      }
    };
  }, [roomId, sessionId, connect, playerId]);

  // Send message helper (not needed for Supabase, but kept for compatibility)
  const sendMessage = useCallback((message) => {
    // Supabase Realtime doesn't support sending custom messages
    // Messages are sent via server-side broadcasts to versus_messages table
    console.warn('[useVersusWebSocket] sendMessage called but Supabase Realtime uses server-side broadcasts');
    return false;
  }, []);

  return {
    isConnected,
    isReconnecting,
    sendMessage
  };
}
