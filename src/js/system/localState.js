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

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'localState.js:75',message:'loadGameState called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            const response = await fetch('/api/game-state', {
                credentials: 'include', // Include cookies
            });

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'localState.js:82',message:'loadGameState response',data:{ok:response.ok,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            if (response.ok) {
                const result = await response.json();
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'localState.js:87',message:'loadGameState result',data:{success:result.success,stateExists:!!result.state,stateLives:result.state?.lives,stateLivesPurchased:result.state?.livesPurchased},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                
                if (result.success && result.state) {
                    return result.state;
                }
            } else {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'localState.js:92',message:'loadGameState response not ok',data:{status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
            }
        } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'localState.js:94',message:'loadGameState error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
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

