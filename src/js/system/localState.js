// LocalStorage state management
export const StateManager = {
    saveGameState(state) {
        try {
            localStorage.setItem('satdoku_game_state', JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    },

    loadGameState() {
        try {
            const saved = localStorage.getItem('satdoku_game_state');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to load game state:', error);
            return null;
        }
    },

    clearGameState() {
        try {
            localStorage.removeItem('satdoku_game_state');
        } catch (error) {
            console.error('Failed to clear game state:', error);
        }
    }
};

