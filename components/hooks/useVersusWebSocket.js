import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client-browser.js';
import { createPresenceHandlers, calculateReconnectDelay } from './useVersusWebSocketHelpers.js';
import monitor from '../../lib/supabase/connectionMonitor.js';

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
  const channelNameRef = useRef(null); // Store original channel name to avoid topic prefix mismatch
  const supabaseRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const connectRef = useRef(null);
  const isConnectingRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const cleanupTimeoutRef = useRef(null); // Deferred cleanup to handle React Strict Mode
  const currentRoomIdRef = useRef(roomId); // Track current roomId to detect true room changes

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onReconnectRef.current = onReconnect;
  }, [onMessage, onReconnect]);

  // Track current roomId to detect true room changes vs sessionId changes
  useEffect(() => {
    currentRoomIdRef.current = roomId;
  }, [roomId]);

  const connect = useCallback(async () => {
    if (!roomId || !sessionId) {
      return;
    }

    const channelName = `room:${roomId}`;
    
    // Cancel any pending deferred cleanup - React Strict Mode re-ran the effect
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
      shouldReconnectRef.current = true; // Reset flag since we're reconnecting
      isCleaningUpRef.current = false; // Reset cleanup flag
    }
    
    // Prevent duplicate connections: if already connecting, cleaning up, or connected, skip
    if (isConnectingRef.current || isCleaningUpRef.current) {
      // Already in the process of connecting or cleaning up, skip duplicate call
      return;
    }
    
    // Check if channel already exists and is connected (use stored channel name to avoid topic prefix mismatch)
    if (channelRef.current && channelNameRef.current === channelName) {
      const state = channelRef.current.state;
      if (state === 'joined' || state === 'joining') {
        // Already connected or connecting, skip
        return;
      }
    }

    // Set connecting flag to prevent concurrent attempts
    isConnectingRef.current = true;

    try {
      // Clean up existing channel before creating new one
      // Wait for unsubscribe to complete to prevent connection leaks
      if (channelRef.current) {
        isCleaningUpRef.current = true;
        const oldChannel = channelRef.current;
        const oldChannelName = channelNameRef.current || channelName; // Use stored name, not topic
        
        monitor.trackChannelCleaned(oldChannelName, roomId, 'connect.before_new_channel');
        
        // Properly cleanup: untrack presence first, then unsubscribe
        try {
          oldChannel.untrack();
        } catch (e) {
          console.warn('[useVersusWebSocket] Error untracking presence:', e);
        }
        
        try {
          // unsubscribe() returns a promise - await it to ensure cleanup completes
          await oldChannel.unsubscribe();
        } catch (e) {
          console.warn('[useVersusWebSocket] Error unsubscribing channel:', e);
        }
        
        channelRef.current = null;
        channelNameRef.current = null;
        isCleaningUpRef.current = false;
      }

      // Reuse existing Supabase client (singleton pattern)
      if (!supabaseRef.current) {
        supabaseRef.current = createSupabaseBrowserClient();
      }
      const supabase = supabaseRef.current;

      monitor.trackChannelCreated(channelName, roomId, 'useVersusWebSocket.connect');

      // Create channel for this room
      const channel = supabase.channel(channelName)
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
        monitor.trackChannelSubscribed(channelName, roomId, status);
        
        if (status === 'SUBSCRIBED') {
          console.log('[useVersusWebSocket] Connected to room:', roomId);
          setIsConnected(true);
          setIsReconnecting(false);
          reconnectAttemptRef.current = 0;
          isConnectingRef.current = false; // Clear connecting flag on success
          
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
          monitor.trackChannelUnsubscribed(channelName, roomId, 'channel_error');
          setIsConnected(false);
          isConnectingRef.current = false; // Clear connecting flag on error/close
          
          // Attempt reconnection
          if (shouldReconnectRef.current && roomId && sessionId) {
            const delay = calculateReconnectDelay(reconnectAttemptRef.current);
            monitor.trackReconnect(roomId, reconnectAttemptRef.current + 1);
            
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
                connectRef.current();
              } else {
                setIsReconnecting(false);
              }
            }, delay);
          }
        }
      });

      channelRef.current = channel;
      channelNameRef.current = channelName; // Store original channel name
    } catch (error) {
      isConnectingRef.current = false; // Clear connecting flag on error
      monitor.trackError(error, 'useVersusWebSocket.connect');
      console.error('[useVersusWebSocket] Error creating Realtime connection:', error);
      setIsReconnecting(true);
      
      // Retry connection
      const delay = calculateReconnectDelay(reconnectAttemptRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnectRef.current && roomId && sessionId) {
          reconnectAttemptRef.current++;
          connectRef.current();
        } else {
          setIsReconnecting(false);
        }
      }, delay);
    }
  }, [roomId, sessionId, playerId]);

  // Store connect function in ref to avoid dependency issues
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    // Subscribe once per room (prescription: "Subscribe once per room")
    // Only connect if we have both roomId and a valid sessionId
    if (roomId && sessionId && sessionId !== 'active' && sessionId.startsWith('session_')) {
      // Only connect if not already cleaning up
      if (!isCleaningUpRef.current) {
        connectRef.current();
      }
    }
    
    // Single cleanup function that handles all cases
    // Uses deferred cleanup to handle React Strict Mode without closing working connections
    return () => {
      shouldReconnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Don't clean up channels that are still joining - this is React Strict Mode's initial cleanup
      if (channelRef.current && channelRef.current.state === 'joining') {
        return;
      }
      
      // Defer actual cleanup to allow React Strict Mode to re-run effect
      // If effect re-runs within 150ms, cleanup will be cancelled
      isCleaningUpRef.current = true;
      
      // Capture roomId at cleanup time to compare with current value in timeout
      const cleanupRoomId = roomId;
      
      cleanupTimeoutRef.current = setTimeout(() => {
        // This runs only if cleanup wasn't cancelled by a reconnect
        if (channelRef.current) {
          const channel = channelRef.current;
          const storedChannelName = channelNameRef.current;
          const channelName = storedChannelName || (cleanupRoomId ? `room:${cleanupRoomId}` : 'unknown');
          
          // Check if roomId actually changed - if same, skip cleanup (sessionId change doesn't need new channel)
          const expectedChannelName = currentRoomIdRef.current ? `room:${currentRoomIdRef.current}` : null;
          if (expectedChannelName && storedChannelName === expectedChannelName) {
            isCleaningUpRef.current = false;
            cleanupTimeoutRef.current = null;
            shouldReconnectRef.current = true; // Allow reconnects again
            return;
          }
          
          monitor.trackChannelCleaned(channelName, cleanupRoomId, 'useEffect.cleanup.deferred');
          
          // Clean up: untrack presence first, then unsubscribe
          try {
            channel.untrack();
          } catch (e) {
            console.warn('[useVersusWebSocket] Error untracking in cleanup:', e);
          }
          
          try {
            channel.unsubscribe().catch((e) => {
              console.warn('[useVersusWebSocket] Error unsubscribing in cleanup:', e);
            });
          } catch (e) {
            console.warn('[useVersusWebSocket] Error calling unsubscribe in cleanup:', e);
          }
          
          channelRef.current = null;
          channelNameRef.current = null;
        }
        
        isCleaningUpRef.current = false;
        cleanupTimeoutRef.current = null;
      }, 150); // 150ms delay - enough for React Strict Mode to re-run effect
    };
  }, [roomId, sessionId]); // Removed playerId - it doesn't change during a session

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
