import { BoardGenerator } from '../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS } from '../../src/js/system/constants.js';
import { addCachedPuzzlesBatch, getCacheCount, needsRefill, CACHE_CONFIG } from './puzzleCache.js';

/**
 * Generate a single puzzle (without uniqueness checking - fast)
 * @param {string} difficulty - Difficulty level
 * @returns {object} - Puzzle with puzzle and solution arrays
 */
function generatePuzzle(difficulty) {
  const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
  const boardGenerator = new BoardGenerator();
  return boardGenerator.generatePuzzle(difficultyConfig);
}

/**
 * Generate puzzles in the background and add them to cache
 * This runs asynchronously and doesn't block
 * @param {string} difficulty - Difficulty level
 * @param {number} count - Number of puzzles to generate
 * @returns {Promise<number>} - Number of puzzles successfully added to cache
 */
export async function generateAndCachePuzzles(difficulty, count) {
  console.log(`[PuzzleGenerator] Generating ${count} puzzles for ${difficulty}...`);
  const startTime = Date.now();
  
  const puzzles = [];
  for (let i = 0; i < count; i++) {
    try {
      const puzzle = generatePuzzle(difficulty);
      puzzles.push(puzzle);
    } catch (error) {
      console.error(`[PuzzleGenerator] Error generating puzzle ${i + 1} for ${difficulty}:`, error);
    }
  }

  const added = await addCachedPuzzlesBatch(difficulty, puzzles);
  const duration = Date.now() - startTime;
  console.log(`[PuzzleGenerator] Generated and cached ${added}/${count} puzzles for ${difficulty} in ${duration}ms`);
  
  return added;
}

/**
 * Check cache levels and refill if needed
 * This runs asynchronously and doesn't block
 * @param {string} difficulty - Difficulty level to check
 * @returns {Promise<void>}
 */
export async function refillCacheIfNeeded(difficulty) {
  try {
    if (await needsRefill(difficulty)) {
      const currentCount = await getCacheCount(difficulty);
      const needed = CACHE_CONFIG.REFILL_AMOUNT;
      console.log(`[PuzzleGenerator] Cache for ${difficulty} is at ${currentCount}, refilling with ${needed} puzzles...`);
      
      // Generate in background (don't await - fire and forget)
      generateAndCachePuzzles(difficulty, needed).catch(error => {
        console.error(`[PuzzleGenerator] Error refilling cache for ${difficulty}:`, error);
      });
    }
  } catch (error) {
    console.error(`[PuzzleGenerator] Error checking cache for ${difficulty}:`, error);
  }
}

/**
 * Initialize cache by pre-generating puzzles for all difficulties
 * This should be called on server startup
 * @returns {Promise<void>}
 */
export async function initializePuzzleCache() {
  console.log('[PuzzleGenerator] Initializing puzzle cache...');
  const difficulties = ['beginner', 'medium', 'hard'];
  
  // Check current cache levels
  const counts = await Promise.all(
    difficulties.map(diff => getCacheCount(diff))
  );
  
  // Generate puzzles for each difficulty that needs them
  const generationPromises = difficulties.map(async (difficulty, index) => {
    const currentCount = counts[index];
    if (currentCount < CACHE_CONFIG.TARGET_CACHE_SIZE) {
      const needed = CACHE_CONFIG.TARGET_CACHE_SIZE - currentCount;
      console.log(`[PuzzleGenerator] Generating ${needed} puzzles for ${difficulty} (current: ${currentCount})...`);
      return generateAndCachePuzzles(difficulty, needed);
    } else {
      console.log(`[PuzzleGenerator] Cache for ${difficulty} already has ${currentCount} puzzles, skipping`);
      return 0;
    }
  });
  
  const results = await Promise.all(generationPromises);
  const total = results.reduce((sum, count) => sum + count, 0);
  console.log(`[PuzzleGenerator] Cache initialization complete. Generated ${total} puzzles total.`);
}

