/**
 * Helper functions for useVersusWebSocket hook
 */

/**
 * DEPRECATED: Connection status is now managed by Presence (ephemeral) only.
 * This function is kept for backwards compatibility but does nothing.
 * Presence = connection truth (ephemeral, in-memory)
 * Postgres = game truth (durable, authoritative)
 */
export async function updateConnectionStatus(roomId, playerId, connected) {
  // No-op: Presence handles connection status, not database
  // This function exists only to avoid breaking existing call sites
  // All call sites should be removed in favor of presence-based UI
}

/**
 * DEPRECATED: Presence handlers are now managed in useVersusPresence hook
 * This function is kept for backwards compatibility but is no longer used
 * Presence = UX only (ephemeral, in-memory)
 * Postgres = game state (durable, authoritative)
 */
export function createPresenceHandlers(channel, roomId, onMessage) {
  // No-op: Presence is now handled entirely in useVersusPresence hook
  // This function exists only to avoid breaking existing call sites
  return {
    onSync: () => {},
    onJoin: () => {},
    onLeave: () => {}
  };
}

/**
 * Calculate reconnection delay with exponential backoff
 * @param {number} attempt - Current reconnection attempt number
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns {number} Delay in milliseconds
 */
export function calculateReconnectDelay(attempt, maxDelay = 30000) {
  return Math.min(1000 * Math.pow(2, attempt), maxDelay);
}
