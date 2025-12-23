import { storeGameState } from '../../redis/gameState.js';
import { trackPuzzleStart } from '../../supabase/puzzleSessions.js';
import { BoardGenerator } from '../../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS, INITIAL_LIVES } from '../../../src/js/system/constants.js';
import { getCachedPuzzle, getCacheCount, CACHE_CONFIG } from '../../redis/puzzleCache.js';
import { refillCacheIfNeeded, generateAndCachePuzzles } from '../../redis/puzzleGenerator.js';

// Track if initialization has been triggered to avoid multiple simultaneous initializations
let initializationInProgress = false;

/**
 * Handle startNewGame action
 */
export async function handleStartNewGame(sessionId, difficulty, expectedVersion) {
  // Try to get puzzle from cache first
  let puzzleData = await getCachedPuzzle(difficulty);
  
  // If cache miss, check if we need to initialize
  if (!puzzleData) {
    const cacheCount = await getCacheCount(difficulty);
    
    // If cache is completely empty, trigger initialization (lazy init)
    if (cacheCount === 0 && !initializationInProgress) {
      initializationInProgress = true;
      console.log(`[startNewGame] Cache empty for ${difficulty}, triggering initialization...`);
      
      // Generate initial batch in background (fire and forget)
      generateAndCachePuzzles(difficulty, CACHE_CONFIG.TARGET_CACHE_SIZE).then(() => {
        initializationInProgress = false;
      }).catch(err => {
        console.error(`[startNewGame] Error initializing cache for ${difficulty}:`, err);
        initializationInProgress = false;
      });
    }
    
    // Generate directly as fallback while cache is being populated
    console.log(`[startNewGame] Cache miss for ${difficulty}, generating directly...`);
    const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    puzzleData = boardGenerator.generatePuzzle(difficultyConfig);
  }
  
  // Trigger background refill if cache is low (fire and forget)
  refillCacheIfNeeded(difficulty).catch(err => {
    console.error(`[startNewGame] Error checking cache refill for ${difficulty}:`, err);
  });
  
  const { puzzle, solution } = puzzleData;

  // Initialize notes as 9x9 array of empty arrays
  const notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

  const newState = {
    currentPuzzle: puzzle,
    currentSolution: solution,
    currentBoard: puzzle.map(row => [...row]),
    difficulty: difficulty,
    mistakes: 0,
    score: 0,
    moves: 0,
    lives: INITIAL_LIVES,
    livesPurchased: 0,
    completedRows: [],
    completedColumns: [],
    completedBoxes: [],
    gameInProgress: true,
    gameStartTime: new Date().toISOString(),
    notes: notes
  };

  // Track puzzle start in Supabase (fire and forget)
  trackPuzzleStart(sessionId, difficulty).catch(err => {
    console.error('[startNewGame] Failed to track puzzle start:', err);
  });

  const result = await storeGameState(sessionId, newState, expectedVersion);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version || 0
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR'
    };
  }

  return {
    success: true,
    state: { ...newState, version: result.version },
    scoreDelta: { points: 0, events: [] },
    modals: { win: false, gameOver: false, purchaseLife: false },
    completed: false,
    completionId: null,
    qualifiedForLeaderboard: false,
    version: result.version
  };
}














