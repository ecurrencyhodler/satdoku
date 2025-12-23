import { storeGameState } from '../../redis/gameState.js';
import { BoardGenerator } from '../../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS } from '../../../src/js/system/constants.js';
import { getCachedPuzzle, getCacheCount, CACHE_CONFIG } from '../../redis/puzzleCache.js';
import { refillCacheIfNeeded, generateAndCachePuzzles } from '../../redis/puzzleGenerator.js';
import { trackPuzzleStart } from '../../supabase/puzzleSessions.js';

// Track if initialization has been triggered per difficulty to avoid multiple simultaneous initializations
const initializationInProgress = new Map();

/**
 * Handle keepPlayingWithDifficulty action
 * Starts a new game with the chosen difficulty while preserving stats (lives, score, mistakes, etc.)
 */
export async function handleKeepPlayingWithDifficulty(sessionId, state, difficulty, currentVersion) {
  // Try to get puzzle from cache first
  let puzzleData = await getCachedPuzzle(difficulty);
  
  // If cache miss, check if we need to initialize
  if (!puzzleData) {
    const cacheCount = await getCacheCount(difficulty);
    
    // If cache is completely empty, trigger initialization (lazy init)
    if (cacheCount === 0 && !initializationInProgress.get(difficulty)) {
      initializationInProgress.set(difficulty, true);
      console.log(`[keepPlayingWithDifficulty] Cache empty for ${difficulty}, triggering initialization...`);
      
      // Generate initial batch in background (fire and forget)
      generateAndCachePuzzles(difficulty, CACHE_CONFIG.TARGET_CACHE_SIZE).then(() => {
        initializationInProgress.set(difficulty, false);
      }).catch(err => {
        console.error(`[keepPlayingWithDifficulty] Error initializing cache for ${difficulty}:`, err);
        initializationInProgress.set(difficulty, false);
      });
    }
    
    // Generate directly as fallback while cache is being populated
    console.log(`[keepPlayingWithDifficulty] Cache miss for ${difficulty}, generating directly...`);
    const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    puzzleData = boardGenerator.generatePuzzle(difficultyConfig);
  }
  
  // Trigger background refill if cache is low (fire and forget)
  refillCacheIfNeeded(difficulty).catch(err => {
    console.error(`[keepPlayingWithDifficulty] Error checking cache refill for ${difficulty}:`, err);
  });
  
  const { puzzle, solution } = puzzleData;

  // Initialize notes as 9x9 array of empty arrays
  const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  // Preserve stats: score, moves, mistakes, lives, livesPurchased
  // Only update: puzzle, solution, board, difficulty, and game state
  const updatedState = {
    ...state,
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]),
    difficulty: difficulty,
    completedRows: [],
    completedColumns: [],
    completedBoxes: [],
    notes: notes,
    gameInProgress: true,
    gameStartTime: new Date().toISOString()
    // Preserved: score, moves, mistakes, lives, livesPurchased
  };

  // Track puzzle start in Supabase (fire and forget)
  trackPuzzleStart(sessionId, difficulty).catch(err => {
    console.error('[keepPlayingWithDifficulty] Failed to track puzzle start:', err);
  });

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

