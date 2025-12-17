// StateManager now uses server-authoritative game actions
// Session is managed via cookies (no client-side sessionId needed)

export const StateManager = {
    /**
     * Clean up old localStorage sessionID (migration from client-side to cookie-based sessions)
     * This is a one-time cleanup that can be called on app initialization
     */
    cleanupOldSessionStorage() {
        if (typeof window === 'undefined') {
            return;
        }

        const OLD_SESSION_KEY = 'satdoku_session_id';
        const oldSessionId = localStorage.getItem(OLD_SESSION_KEY);

        if (oldSessionId) {
            localStorage.removeItem(OLD_SESSION_KEY);
            console.log('[StateManager] Cleaned up old localStorage sessionID (now using cookies)');
        }
    },
    /**
     * Send a game action to the server
     * @param {object} action - Action object (e.g., { action: "placeNumber", row, col, value })
     * @param {number|null} expectedVersion - Expected version for optimistic locking
     * @returns {Promise<object>} Result with success, state, modals, completionId, etc.
     */
    async sendGameAction(action, expectedVersion = null) {
        try {
            if (typeof window === 'undefined') {
                return { success: false, error: 'Not in browser context' };
            }

            const response = await fetch('/api/game-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies
                body: JSON.stringify({ ...action, expectedVersion }),
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle version conflicts
                if (result.errorCode === 'VERSION_CONFLICT') {
                    return {
                        success: false,
                        conflict: true,
                        version: result.version,
                        error: result.error,
                        errorCode: result.errorCode
                    };
                }

                return {
                    success: false,
                    error: result.error || 'Action failed',
                    errorCode: result.errorCode
                };
            }

            return result;
        } catch (error) {
            console.error('Failed to send game action:', error);
            return {
                success: false,
                error: 'Network error',
                errorCode: 'NETWORK_ERROR'
            };
        }
    },

    async loadGameState() {
        try {
            if (typeof window === 'undefined') {
                return null;
            }

            const response = await fetch('/api/game-state', {
                credentials: 'include', // Include cookies
            });

            if (response.ok) {
                const result = await response.json();

                if (result.success && result.state) {
                    return result.state;
                }
            }
        } catch (error) {
            console.error('Failed to load game state:', error);
        }

        return null;
    },

    async clearGameState() {
        try {
            if (typeof window !== 'undefined') {
                await fetch('/api/game-state', {
                    method: 'DELETE',
                    credentials: 'include', // Include cookies
                });
            }
        } catch (error) {
            console.error('Failed to clear game state:', error);
        }
    }
};

