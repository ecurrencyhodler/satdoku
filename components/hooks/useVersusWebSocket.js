import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client-browser.js';
import { createPresenceHandlers, calculateReconnectDelay } from './useVersusWebSocketHelpers.js';

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
        // Register presence event listeners BEFORE subscribing (required for sync to fire)
        // Listen for presence.sync (prescription: "Listen for presence.sync")
        .on('presence', { event: 'sync' }, () => {
          // Notify message handler to trigger presence update in useVersusPresence
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'presence_sync',
              presenceState: channel.presenceState()
            });
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'presence_join',
              presenceState: channel.presenceState()
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          if (onMessageRef.current) {
            onMessageRef.current({
              type: 'presence_leave',
              presenceState: channel.presenceState()
            });
          }
        });

      // Subscribe to channel (presence listeners must be registered before this)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useVersusWebSocket] Connected to room:', roomId);
          setIsConnected(true);
          setIsReconnecting(false);
          reconnectAttemptRef.current = 0;
          
          // Track presence immediately on join (prescription: "Track presence immediately on join")
          channel.track({
            playerId: playerId,
            sessionId: sessionId,
            selectedCell: null // Initialize with no selected cell
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
            const delay = calculateReconnectDelay(reconnectAttemptRef.current);
            
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
      const delay = calculateReconnectDelay(reconnectAttemptRef.current);
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
    // Subscribe once per room (prescription: "Subscribe once per room")
    // Only connect if we have both roomId and a valid sessionId
    if (roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
      // Connect immediately
      connect();
      
      return () => {
        shouldReconnectRef.current = false;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (channelRef.current) {
          // Clean up: unsubscribe and untrack presence
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
    sendMessage,
    channel: channelRef.current
  };
}
