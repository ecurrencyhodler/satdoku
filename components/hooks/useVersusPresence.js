import { useState, useEffect, useCallback } from 'react';

/**
 * Helper function to get player presence from presence state
 * @param {object} presenceState - Presence state from channel
 * @param {string} targetPlayerId - Player ID to check ('player1' or 'player2')
 * @returns {object} { connected: boolean, sessionId?: string, selectedCell?: {row: number, col: number} }
 */
export function getPlayerPresence(presenceState, targetPlayerId) {
  for (const [sessionId, presences] of Object.entries(presenceState)) {
    const presence = Array.isArray(presences) ? presences[0] : presences;
    if (presence?.playerId === targetPlayerId) {
      return { 
        connected: true, 
        sessionId,
        selectedCell: presence?.selectedCell || null
      };
    }
  }
  return { connected: false };
}

/**
 * Hook for reading Presence from shared channel
 * @param {object} channel - Supabase Realtime channel (from useVersusWebSocket)
 * @param {string} currentPlayerId - Current player's ID ('player1' or 'player2') to determine opponent
 * @returns {object} { player1Connected: boolean, player2Connected: boolean, opponentSelectedCell: {row, col}|null, presenceState: object, triggerUpdate: function }
 */
export function useVersusPresence(channel, currentPlayerId) {
  const [presenceState, setPresenceState] = useState({});
  const [player1Connected, setPlayer1Connected] = useState(false);
  const [player2Connected, setPlayer2Connected] = useState(false);
  const [opponentSelectedCell, setOpponentSelectedCell] = useState(null);

  // Always derive connected players from presenceState() (prescription)
  const updatePresence = useCallback(() => {
    if (!channel) {
      setPresenceState({});
      setPlayer1Connected(false);
      setPlayer2Connected(false);
      setOpponentSelectedCell(null);
      return;
    }

    // Always derive from presenceState() - this is the source of truth
    const state = channel.presenceState();
    setPresenceState(state);

    const player1Presence = getPlayerPresence(state, 'player1');
    const player2Presence = getPlayerPresence(state, 'player2');

    setPlayer1Connected(player1Presence.connected);
    setPlayer2Connected(player2Presence.connected);

    // Extract opponent's selected cell from presence
    const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';
    const opponentPresence = opponentId === 'player1' ? player1Presence : player2Presence;
    setOpponentSelectedCell(opponentPresence?.selectedCell || null);
  }, [channel, currentPlayerId]);

  useEffect(() => {
    if (!channel) {
      return;
    }

    // Initial sync - derive from presenceState() immediately
    updatePresence();

    // Poll periodically as a fallback since events might be missed
    // Note: Presence events are forwarded via WebSocket messages from useVersusWebSocket
    // and triggerUpdate is called from those messages
    const pollInterval = setInterval(() => {
      updatePresence();
    }, 1000); // Poll every 1 second as fallback

    return () => {
      clearInterval(pollInterval);
    };
  }, [channel, updatePresence]);

  // Note: We removed the direct presence listeners here because they must be registered
  // BEFORE channel.subscribe() is called. Since useVersusWebSocket already registers
  // listeners before subscribe and forwards events via onMessage, we rely on triggerUpdate
  // being called from those forwarded messages instead.

  return {
    player1Connected,
    player2Connected,
    opponentSelectedCell,
    presenceState,
    triggerUpdate: updatePresence
  };
}
