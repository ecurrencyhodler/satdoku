import { getRoom, updateRoomState } from '../../redis/versusRooms.js';
import { GameValidation } from '../gameValidation.js';
import { GameScoring } from '../gameScoring.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';

/**
 * Handle placeNumber action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col, value
 * @returns {Promise<object>}
 */
export async function handleVersusPlaceNumber(roomId, sessionId, action) {
  const { row, col, value } = action;

  // Get current room state
  const room = await getRoom(roomId);
  if (!room) {
    return {
      success: false,
      error: 'Room not found',
      errorCode: 'ROOM_NOT_FOUND'
    };
  }

  // Determine which player this is
  let playerId = null;
  let player = null;
  if (room.players.player1?.sessionId === sessionId) {
    playerId = 'player1';
    player = room.players.player1;
  } else if (room.players.player2?.sessionId === sessionId) {
    playerId = 'player2';
    player = room.players.player2;
  } else {
    return {
      success: false,
      error: 'Player not found in room',
      errorCode: 'PLAYER_NOT_FOUND'
    };
  }

  // Check if game is in progress
  if (room.gameStatus !== 'playing') {
    return {
      success: false,
      error: 'Game is not in progress',
      errorCode: 'GAME_NOT_STARTED'
    };
  }

  // Check if player has lives
  if (player.lives <= 0) {
    return {
      success: false,
      error: 'No lives remaining. Please purchase a life to continue.',
      errorCode: 'NO_LIVES'
    };
  }

  // Validate action
  const validation = GameValidation.validatePlaceNumber(room, row, col, value);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      errorCode: validation.errorCode || 'INVALID_MOVE'
    };
  }

  // Check if cell is already filled (conflict detection)
  const currentValue = room.currentBoard[row][col];
  if (currentValue !== 0 && currentValue === room.currentPuzzle[row][col]) {
    // Cell is already filled with correct value (prefilled)
    return {
      success: false,
      error: 'Cell is already filled',
      errorCode: 'CELL_ALREADY_FILLED'
    };
  }

  // Check if another player just filled this cell (conflict)
  // We check if the cell has a value that's not from the puzzle
  if (currentValue !== 0 && currentValue !== room.currentPuzzle[row][col]) {
    // Someone else filled this cell - conflict
    return {
      success: false,
      error: 'Cell was already filled by another player',
      errorCode: 'CELL_CONFLICT'
    };
  }

  // Check if move is correct
  const isCorrect = room.currentSolution[row][col] === value;

  // Clear notes for this cell
  const updatedPlayerNotes = player.notes.map((r, i) =>
    i === row ? r.map((c, j) => j === col ? [] : c) : r
  );

  let updatedRoom = { ...room };
  let scoreDelta = { points: 0, events: [] };
  let modals = { win: false, gameOver: false, purchaseLife: false };
  let notification = null;

  if (isCorrect) {
    // Process correct move
    updatedRoom.currentBoard = room.currentBoard.map((r, i) =>
      i === row ? r.map((c, j) => j === col ? value : c) : r
    );

    // Update player's notes
    updatedRoom.players[playerId].notes = updatedPlayerNotes;

    // Calculate scoring for this player
    const scoringState = {
      currentBoard: updatedRoom.currentBoard,
      completedRows: room.completedRows || [],
      completedColumns: room.completedColumns || [],
      completedBoxes: room.completedBoxes || []
    };

    const scoringResult = GameScoring.processCorrectMove(scoringState, row, col);
    
    // Update player's score
    updatedRoom.players[playerId].score += scoringResult.points;
    
    // Update shared completion tracking
    updatedRoom.completedRows = scoringResult.completedRows;
    updatedRoom.completedColumns = scoringResult.completedColumns;
    updatedRoom.completedBoxes = scoringResult.completedBoxes;

    scoreDelta = {
      points: scoringResult.points,
      events: scoringResult.events,
      playerId: playerId
    };

    // Check for win
    const isWin = GameValidation.isPuzzleComplete(updatedRoom.currentBoard);
    if (isWin) {
      // Determine winner
      const player1Score = updatedRoom.players.player1?.score || 0;
      const player2Score = updatedRoom.players.player2?.score || 0;
      
      if (player1Score > player2Score) {
        updatedRoom.winner = 'player1';
      } else if (player2Score > player1Score) {
        updatedRoom.winner = 'player2';
      } else {
        // Tie - first to complete wins (this player just completed it)
        updatedRoom.winner = playerId;
      }
      
      updatedRoom.gameStatus = 'finished';
      updatedRoom.completedAt = new Date().toISOString();
      updatedRoom.finishedAt = new Date().toISOString();
      updatedRoom.gameInProgress = false;
      
      // Set room expiration to 12 hours from now when game finishes
      // This is handled in updateRoomState, but we ensure finishedAt is set
    }
  } else {
    // Process incorrect move
    updatedRoom.currentBoard = room.currentBoard.map((r, i) =>
      i === row ? r.map((c, j) => j === col ? value : c) : r
    );

    // Update player's notes
    updatedRoom.players[playerId].notes = updatedPlayerNotes;

    // Update player's mistakes and lives
    updatedRoom.players[playerId].mistakes += 1;
    updatedRoom.players[playerId].lives = Math.max(0, player.lives - 1);

    scoreDelta = {
      points: 0,
      events: [{ type: 'error', row, col }],
      playerId: playerId
    };

    // Check if lives reached 0
    if (updatedRoom.players[playerId].lives === 0) {
      modals.purchaseLife = true;
    }
  }

  // Save updated state
  const result = await updateRoomState(roomId, updatedRoom, room.version);

  if (!result.success) {
    if (result.conflict) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: result.version
      };
    }
    return {
      success: false,
      error: 'Failed to save game state',
      errorCode: 'NETWORK_ERROR'
    };
  }

  // Broadcast state update to all players
  const updatedRoomWithVersion = { ...updatedRoom, version: result.version };
  broadcastToWebSocket(roomId, {
    type: 'state_update',
    room: updatedRoomWithVersion,
    scoreDelta,
    modals,
    notification
  });

  return {
    success: true,
    state: updatedRoomWithVersion,
    scoreDelta,
    modals,
    notification,
    completed: updatedRoom.gameStatus === 'finished',
    version: result.version
  };
}

