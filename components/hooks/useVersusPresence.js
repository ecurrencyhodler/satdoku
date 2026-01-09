import { useState, useEffect, useCallback } from 'react';

/**
 * Helper function to get player presence from presence state
 * @param {object} presenceState - Presence state from channel
 * @param {string} targetPlayerId - Player ID to check ('player1' or 'player2')
 * @returns {object} { connected: boolean, sessionId?: string }
 */
export function getPlayerPresence(presenceState, targetPlayerId) {
  for (const [sessionId, presences] of Object.entries(presenceState)) {
    const presence = Array.isArray(presences) ? presences[0] : presences;
    if (presence?.playerId === targetPlayerId) {
      return { connected: true, sessionId };
    }
  }
  return { connected: false };
}

/**
 * Hook for reading Presence from shared channel
 * @param {object} channel - Supabase Realtime channel (from useVersusWebSocket)
 * @returns {object} { player1Connected: boolean, player2Connected: boolean, presenceState: object }
 */
export function useVersusPresence(channel) {
  const [presenceState, setPresenceState] = useState({});
  const [player1Connected, setPlayer1Connected] = useState(false);
  const [player2Connected, setPlayer2Connected] = useState(false);

  const updatePresence = useCallback(() => {
    if (!channel) {
      setPresenceState({});
      setPlayer1Connected(false);
      setPlayer2Connected(false);
      return;
    }

    const state = channel.presenceState();
    setPresenceState(state);

    const player1Presence = getPlayerPresence(state, 'player1');
    const player2Presence = getPlayerPresence(state, 'player2');

    setPlayer1Connected(player1Presence.connected);
    setPlayer2Connected(player2Presence.connected);
  }, [channel]);

  useEffect(() => {
    if (!channel) {
      return;
    }

    // Initial sync
    updatePresence();

    // Listen for presence changes
    const handlePresenceSync = () => {
      updatePresence();
    };

    const handlePresenceJoin = () => {
      updatePresence();
    };

    const handlePresenceLeave = () => {
      updatePresence();
    };

    channel.on('presence', { event: 'sync' }, handlePresenceSync);
    channel.on('presence', { event: 'join' }, handlePresenceJoin);
    channel.on('presence', { event: 'leave' }, handlePresenceLeave);

    return () => {
      channel.off('presence', { event: 'sync' }, handlePresenceSync);
      channel.off('presence', { event: 'join' }, handlePresenceJoin);
      channel.off('presence', { event: 'leave' }, handlePresenceLeave);
    };
  }, [channel, updatePresence]);

  return {
    player1Connected,
    player2Connected,
    presenceState
  };
}
