// Re-export all Redis functions for backward compatibility
// New code should import directly from specific modules:
// - lib/redis/client.js
// - lib/redis/gameState.js
// - lib/redis/completions.js

export { getRedisClient, resetRedisClient } from './redis/client.js';
export { storeGameState, getGameState, deleteGameState } from './redis/gameState.js';
export { saveCompletion } from './redis/completions.js';

// Default export for backward compatibility
export { default } from './redis/client.js';
