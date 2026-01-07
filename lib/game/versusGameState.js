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

/**
 * Transform versus room state to client format
 * @param {object} roomState - Room state from Redis
 * @param {string} playerId - 'player1' or 'player2' or null for spectator
 * @returns {object}
 */
export function transformVersusStateToClient(roomState, playerId) {
  if (!roomState) return null;

  const isPlayer1 = playerId === 'player1';
  const isPlayer2 = playerId === 'player2';
  const isSpectator = !isPlayer1 && !isPlayer2;

  // Get player's own notes
  const playerNotes = isPlayer1 
    ? (roomState.players.player1?.notes || [])
    : isPlayer2
    ? (roomState.players.player2?.notes || [])
    : [];

  // Get opponent's selected cell
  const opponentSelectedCell = isPlayer1
    ? roomState.players.player2?.selectedCell
    : isPlayer2
    ? roomState.players.player1?.selectedCell
    : null;

  return {
    // Board state
    board: roomState.currentBoard || roomState.board,
    puzzle: roomState.currentPuzzle || roomState.puzzle,
    solution: roomState.currentSolution || roomState.solution,
    
    // Game metadata
    difficulty: roomState.difficulty,
    gameStatus: roomState.gameStatus,
    countdown: roomState.countdown,
    roomId: roomState.roomId,
    
    // Player data
    playerId: playerId,
    players: {
      player1: {
        name: roomState.players.player1?.name || 'Player 1',
        score: roomState.players.player1?.score || 0,
        lives: roomState.players.player1?.lives || 0,
        mistakes: roomState.players.player1?.mistakes || 0,
        ready: roomState.players.player1?.ready || false,
        connected: roomState.players.player1?.connected || false
      },
      player2: roomState.players.player2 ? {
        name: roomState.players.player2.name,
        score: roomState.players.player2.score || 0,
        lives: roomState.players.player2.lives || 0,
        mistakes: roomState.players.player2.mistakes || 0,
        ready: roomState.players.player2.ready || false,
        connected: roomState.players.player2.connected || false
      } : null
    },
    
    // Your stats (if you're a player)
    score: isPlayer1 
      ? (roomState.players.player1?.score || 0)
      : isPlayer2
      ? (roomState.players.player2?.score || 0)
      : 0,
    lives: isPlayer1
      ? (roomState.players.player1?.lives || 0)
      : isPlayer2
      ? (roomState.players.player2?.lives || 0)
      : 0,
    mistakes: isPlayer1
      ? (roomState.players.player1?.mistakes || 0)
      : isPlayer2
      ? (roomState.players.player2?.mistakes || 0)
      : 0,
    
    // Game progress
    completedRows: roomState.completedRows || [],
    completedColumns: roomState.completedColumns || [],
    completedBoxes: roomState.completedBoxes || [],
    
    // Notes (player's own notes)
    notes: playerNotes,
    
    // Opponent selection
    opponentSelectedCell: opponentSelectedCell,
    
    // Win condition
    winner: roomState.winner,
    completedAt: roomState.completedAt,
    
    // Version for optimistic locking
    version: roomState.version || 0,
    
    // Spectator flag
    isSpectator: isSpectator
  };
}

