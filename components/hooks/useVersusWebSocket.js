import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client-browser.js';

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
        // Subscribe to versus_rooms table changes (source of truth for start_at)
        // Broadcasts are just a nudge - actual data comes from Postgres
        .on('postgres_changes', {
          event: '*',  // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'versus_rooms',
          filter: `room_id=eq.${roomId}`
        }, async (payload) => {
          console.log('[useVersusWebSocket] Postgres change received:', payload.eventType, payload.new);
          // Handle direct room update from Postgres (source of truth)
          // Only update start_at if it was just set (was null, now has a value)
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'room_update',
              room: payload.new,
              old: payload.old,
              eventType: payload.eventType
            });
          }
        })
        // Subscribe to broadcast messages (postgres_changes)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'versus_messages',
          filter: `room_id=eq.${roomId}`
        }, async (payload) => {
          console.log('[useVersusWebSocket] Broadcast message INSERT received:', payload.new?.message?.type);
          // Handle broadcast message
          const message = payload.new.message;
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
          // Note: Messages are cleaned up by the cron job at /api/cron/cleanup-versus-rooms/
          // No client-side deletion needed
        })
        // Set up presence handlers
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
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          // Player joined (key is sessionId)
          // newPresences contains [{ playerId, sessionId }]
          const joinedPlayerId = newPresences[0]?.playerId;
          
          // Only update database if it's a player (not a spectator)
          if (joinedPlayerId === 'player1' || joinedPlayerId === 'player2') {
            try {
              const response = await fetch('/api/versus/connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId,
                  playerId: joinedPlayerId,
                  connected: true
                })
              });
              
              const result = await response.json();
              
              if (!result.success) {
                console.error('[useVersusWebSocket] Failed to update connection status:', result.error);
              }
            } catch (error) {
              console.error('[useVersusWebSocket] Error updating connection status:', error);
            }
          }
          
          // Notify message handler AFTER database update completes
          // This ensures state reload happens after connection status is updated
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'player_connected',
              sessionId: key,
              playerId: joinedPlayerId
            });
          }
        })
        .on('presence', { event: 'leave' }, async ({ key, leftPresences }) => {
          // Player left (key is sessionId)
          // leftPresences contains [{ playerId, sessionId }]
          const leftPlayerId = leftPresences[0]?.playerId;
          
          // Only update database if it's a player (not a spectator)
          if (leftPlayerId === 'player1' || leftPlayerId === 'player2') {
            try {
              const response = await fetch('/api/versus/connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId,
                  playerId: leftPlayerId,
                  connected: false
                })
              });
              
              const result = await response.json();
              
              if (!result.success) {
                console.error('[useVersusWebSocket] Failed to update connection status:', result.error);
              }
            } catch (error) {
              console.error('[useVersusWebSocket] Error updating connection status:', error);
            }
          }
          
          // Notify message handler
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'player_disconnected',
              sessionId: key,
              playerId: leftPlayerId
            });
          }
        });

      // Subscribe to channel first (must be done before tracking presence)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useVersusWebSocket] Connected to room:', roomId);
          setIsConnected(true);
          setIsReconnecting(false);
          reconnectAttemptRef.current = 0;
          
          // Track presence AFTER subscription is confirmed
          channel.track({
            playerId: playerId,
            sessionId: sessionId
          });
          
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
          // Update connection status before untracking
          if (roomId && (playerId === 'player1' || playerId === 'player2')) {
            // Fire and forget - don't wait for response
            fetch('/api/versus/connection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                playerId,
                connected: false
              })
            }).catch(err => {
              console.error('[useVersusWebSocket] Error updating connection status on unmount:', err);
            });
          }
          
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
        // Update connection status before untracking
        if (roomId && (playerId === 'player1' || playerId === 'player2')) {
          // Fire and forget - don't wait for response
          fetch('/api/versus/connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              playerId,
              connected: false
            })
          }).catch(err => {
            console.error('[useVersusWebSocket] Error updating connection status on cleanup:', err);
          });
        }
        
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
