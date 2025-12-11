// StateManager now uses Redis via API instead of localStorage
// Falls back to localStorage if API fails or is unavailable

// Helper function to get session ID (only works in browser context)
async function getSessionIdHelper() {
    if (typeof window === 'undefined') {
        return null;
    }
    
    try {
        const { getSessionId } = await import('../../../lib/sessionId.js');
        return getSessionId();
    } catch (error) {
        console.error('Failed to import sessionId utility:', error);
        return null;
    }
}

export const StateManager = {
    async saveGameState(state, expectedVersion = null) {
        try {
            // Try to get session ID and save to Redis - if we're in browser context
            if (typeof window !== 'undefined') {
                const sessionId = await getSessionIdHelper();
                if (sessionId) {
                    const response = await fetch('/api/game-state', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ sessionId, state, expectedVersion }),
                    });

                    if (response.ok) {
                        const result = await response.json();
                        // Return version for future updates
                        return { success: true, version: result.version };
                    } else if (response.status === 409) {
                        // Version conflict
                        const result = await response.json();
                        return { success: false, conflict: true, error: result.error };
                    }
                }
            }
        } catch (error) {
            console.error('Failed to save game state to Redis:', error);
        }

        // Fall back to localStorage if API fails or not in browser
        try {
            if (typeof window !== 'undefined') {
                // Check version if expectedVersion is provided
                if (expectedVersion !== null) {
                    const saved = localStorage.getItem('satdoku_game_state');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        const currentVersion = parsed.version ?? 0;
                        if (currentVersion !== expectedVersion) {
                            console.warn(`[localStorage] Version conflict: expected ${expectedVersion}, got ${currentVersion}`);
                            return { success: false, conflict: true };
                        }
                    }
                }
                
                // Increment version and save
                const saved = localStorage.getItem('satdoku_game_state');
                const currentVersion = saved ? (JSON.parse(saved).version ?? 0) : 0;
                const newVersion = currentVersion + 1;
                const stateWithVersion = { ...state, version: newVersion };
                localStorage.setItem('satdoku_game_state', JSON.stringify(stateWithVersion));
                return { success: true, version: newVersion };
            }
        } catch (localError) {
            console.error('Failed to save to localStorage fallback:', localError);
        }
        
        return { success: false };
    },
    
    /**
     * Merge partial state update with existing state
     * This prevents overwriting concurrent changes
     */
    async mergeGameState(partialState) {
        try {
            // Load current state first
            const currentState = await this.loadGameState();
            const mergedState = currentState 
                ? { ...currentState, ...partialState }
                : partialState;
            
            // Save merged state with version check
            const expectedVersion = currentState?.version ?? null;
            return await this.saveGameState(mergedState, expectedVersion);
        } catch (error) {
            console.error('Failed to merge game state:', error);
            return { success: false };
        }
    },

    async loadGameState() {
        try {
            // Try to get session ID and load from Redis - if we're in browser context
            if (typeof window !== 'undefined') {
                const sessionId = await getSessionIdHelper();
                if (sessionId) {
                    const response = await fetch(`/api/game-state?session-id=${encodeURIComponent(sessionId)}`);
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.success && result.state) {
                            return result.state;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load game state from Redis:', error);
        }

        // Fall back to localStorage
        try {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('satdoku_game_state');
                return saved ? JSON.parse(saved) : null;
            }
        } catch (localError) {
            console.error('Failed to load from localStorage fallback:', localError);
            return null;
        }
        
        return null;
    },

    async clearGameState() {
        try {
            // Try to delete from Redis
            if (typeof window !== 'undefined') {
                const sessionId = await getSessionIdHelper();
                if (sessionId) {
                    await fetch(`/api/game-state?session-id=${encodeURIComponent(sessionId)}`, {
                        method: 'DELETE',
                    });
                }
            }
        } catch (error) {
            console.error('Failed to clear game state from Redis:', error);
        }

        // Also clear localStorage
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('satdoku_game_state');
            }
        } catch (localError) {
            console.error('Failed to clear localStorage:', localError);
        }
    }
};

