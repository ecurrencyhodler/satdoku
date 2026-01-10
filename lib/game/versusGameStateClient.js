/**
 * Client-side transformation utilities for versus game state
 * This file has NO server-side dependencies (no Redis, no Node.js modules)
 * Safe to import in client components
 */

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
    status: roomState.status || roomState.gameStatus, // Support both for migration
    gameStatus: roomState.status || roomState.gameStatus, // Alias for backward compatibility
    start_at: roomState.start_at || roomState.gameStartTime, // Support both for migration
    gameStartTime: roomState.start_at || roomState.gameStartTime, // Alias for backward compatibility
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
        connected: roomState.players.player1?.connected !== undefined ? roomState.players.player1.connected : true
      },
      player2: roomState.players.player2 ? {
        name: roomState.players.player2.name,
        score: roomState.players.player2.score || 0,
        lives: roomState.players.player2.lives || 0,
        mistakes: roomState.players.player2.mistakes || 0,
        ready: roomState.players.player2.ready || false,
        connected: roomState.players.player2.connected !== undefined ? roomState.players.player2.connected : true
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

