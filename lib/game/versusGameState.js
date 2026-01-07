import { BoardGenerator } from '../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS, INITIAL_LIVES } from '../../src/js/system/constants.js';
import { getCachedPuzzle, getCacheCount, CACHE_CONFIG } from '../redis/puzzleCache.js';
import { refillCacheIfNeeded, generateAndCachePuzzles } from '../redis/puzzleGenerator.js';

// Track if initialization has been triggered to avoid multiple simultaneous initializations
let initializationInProgress = false;

/**
 * Initialize a new versus game state
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<{puzzle: Array, solution: Array}>}
 */
async function generatePuzzleForVersus(difficulty) {
  // Try to get puzzle from cache first
  let puzzleData = await getCachedPuzzle(difficulty);
  
  // If cache miss, check if we need to initialize
  if (!puzzleData) {
    const cacheCount = await getCacheCount(difficulty);
    
    // If cache is completely empty, trigger initialization (lazy init)
    if (cacheCount === 0 && !initializationInProgress) {
      initializationInProgress = true;
      console.log(`[versusGameState] Cache empty for ${difficulty}, triggering initialization...`);
      
      // Generate initial batch in background (fire and forget)
      generateAndCachePuzzles(difficulty, CACHE_CONFIG.TARGET_CACHE_SIZE).then(() => {
        initializationInProgress = false;
      }).catch(err => {
        console.error(`[versusGameState] Error initializing cache for ${difficulty}:`, err);
        initializationInProgress = false;
      });
    }
    
    // Generate directly as fallback while cache is being populated
    console.log(`[versusGameState] Cache miss for ${difficulty}, generating directly...`);
    const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    puzzleData = boardGenerator.generatePuzzle(difficultyConfig);
  }
  
  // Trigger background refill if cache is low (fire and forget)
  refillCacheIfNeeded(difficulty).catch(err => {
    console.error(`[versusGameState] Error checking cache refill for ${difficulty}:`, err);
  });
  
  return puzzleData;
}

/**
 * Create initial versus game state with puzzle
 * @param {string} difficulty - Difficulty level
 * @returns {Promise<object>}
 */
export async function createVersusGameState(difficulty) {
  const puzzleData = await generatePuzzleForVersus(difficulty);
  const { puzzle, solution } = puzzleData;

  // Initialize notes as 9x9 array of empty arrays for each player
  const emptyNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  return {
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]), // Deep copy
    difficulty: difficulty,
    completedRows: [],
    completedColumns: [],
    completedBoxes: [],
    gameInProgress: true,
    gameStartTime: null, // Will be set when countdown reaches 0
    notes: emptyNotes, // Shared board notes (not used in versus, but kept for compatibility)
    board: puzzle.map(row => [...row]), // Alias for client compatibility
    puzzle: puzzle, // Alias for client compatibility
    solution: solution // Alias for client compatibility
  };
}

// Re-export transformVersusStateToClient from client-safe module for server-side use
export { transformVersusStateToClient } from './versusGameStateClient.js';

