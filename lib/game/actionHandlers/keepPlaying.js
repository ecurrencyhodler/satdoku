import { storeGameState } from '../../redis/gameState.js';
import { BoardGenerator } from '../../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS } from '../../../src/js/system/constants.js';
import { getCachedPuzzle, getCacheCount, CACHE_CONFIG } from '../../redis/puzzleCache.js';
import { refillCacheIfNeeded, generateAndCachePuzzles } from '../../redis/puzzleGenerator.js';

// Track if initialization has been triggered to avoid multiple simultaneous initializations
let initializationInProgress = false;

/**
 * Handle keepPlaying action
 */
export async function handleKeepPlaying(sessionId, state, currentVersion) {
  // Try to get puzzle from cache first
  let puzzleData = await getCachedPuzzle(state.difficulty);
  
  // If cache miss, check if we need to initialize
  if (!puzzleData) {
    const cacheCount = await getCacheCount(state.difficulty);
    
    // If cache is completely empty, trigger initialization (lazy init)
    if (cacheCount === 0 && !initializationInProgress) {
      initializationInProgress = true;
      console.log(`[keepPlaying] Cache empty for ${state.difficulty}, triggering initialization...`);
      
      // Generate initial batch in background (fire and forget)
      generateAndCachePuzzles(state.difficulty, CACHE_CONFIG.TARGET_CACHE_SIZE).then(() => {
        initializationInProgress = false;
      }).catch(err => {
        console.error(`[keepPlaying] Error initializing cache for ${state.difficulty}:`, err);
        initializationInProgress = false;
      });
    }
    
    // Generate directly as fallback while cache is being populated
    console.log(`[keepPlaying] Cache miss for ${state.difficulty}, generating directly...`);
    const difficultyConfig = DIFFICULTY_LEVELS[state.difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    puzzleData = boardGenerator.generatePuzzle(difficultyConfig);
  }
  
  // Trigger background refill if cache is low (fire and forget)
  refillCacheIfNeeded(state.difficulty).catch(err => {
    console.error(`[keepPlaying] Error checking cache refill for ${state.difficulty}:`, err);
  });
  
  const { puzzle, solution } = puzzleData;

  // Initialize notes as 9x9 array of empty arrays
  const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  const updatedState = {
    ...state,
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]),
    completedRows: [],
    completedColumns: [],
    completedBoxes: [],
    notes: notes,
    gameInProgress: true,
    gameStartTime: new Date().toISOString()
    // Preserve: score, moves, mistakes, lives, livesPurchased, difficulty
  };

  const result = await storeGameState(sessionId, updatedState, currentVersion);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version || currentVersion
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR',
      version: currentVersion
    };
  }

  return {
    success: true,
    state: { ...updatedState, version: result.version },
    scoreDelta: { points: 0, events: [] },
    modals: { win: false, gameOver: false, purchaseLife: false },
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}












