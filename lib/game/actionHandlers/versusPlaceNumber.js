import { getRoom, updateRoomState } from '../../redis/versusRooms.js';
import { GameValidation } from '../gameValidation.js';
import { GameScoring } from '../gameScoring.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';
import fs from 'fs';
import path from 'path';

/**
 * Handle placeNumber action for versus mode
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with row, col, value
 * @returns {Promise<object>}
 */
export async function handleVersusPlaceNumber(roomId, sessionId, action) {
  const { row, col, value } = action;
  // #region agent log
  try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:16',message:'handleVersusPlaceNumber called',data:{roomId,row,col,value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion

  // Get current room state
  const room = await getRoom(roomId);
  // #region agent log
  try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:20',message:'Room state loaded',data:{roomId,gameStatus:room?.gameStatus,hasBoard:!!room?.currentBoard,boardFilledCells:room?.currentBoard?.flat().filter(v=>v!==0).length||0,totalCells:81},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
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

  // Check if cell is already filled with correct value (prefilled or correctly filled)
  const currentValue = room.currentBoard[row][col];
  const puzzleValue = room.currentPuzzle[row][col];
  const solutionValue = room.currentSolution[row][col];
  // #region agent log
  try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:79',message:'Checking cell state',data:{roomId,row,col,value,currentValue,puzzleValue,solutionValue,isPrefilled:currentValue!==0&&currentValue===puzzleValue,isCorrectlyFilled:currentValue!==0&&currentValue===solutionValue&&currentValue!==puzzleValue,isIncorrect:currentValue!==0&&currentValue!==solutionValue,boardFilledCells:room.currentBoard.flat().filter(v=>v!==0).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  
  // Only block if cell is prefilled (from puzzle) or already correctly filled
  // IMPORTANT: Any player can overwrite incorrect values (currentValue !== 0 && currentValue !== solutionValue)
  // This allows players to correct mistakes - whether their own or from their opponent
  // and enables puzzle completion even when cells have incorrect values
  if (currentValue !== 0 && (currentValue === puzzleValue || currentValue === solutionValue)) {
    // Cell is already filled with correct value (prefilled or correctly filled) - cannot overwrite
    return {
      success: false,
      error: 'Cell is already filled',
      errorCode: 'CELL_ALREADY_FILLED'
    };
  }
  
  // If we reach here, the cell is either:
  // 1. Empty (currentValue === 0) - can place a value
  // 2. Has an incorrect value (currentValue !== 0 && currentValue !== solutionValue) - ANY player can overwrite
  //    - Can overwrite with a different incorrect value
  //    - Can overwrite with the same incorrect value (will process as another incorrect move and deduct a life)
  //    - Can overwrite with the correct value (will process as a correct move)

  // Check if move is correct
  const isCorrect = room.currentSolution[row][col] === value;
  // #region agent log
  try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:97',message:'Move validation result',data:{roomId,row,col,value,isCorrect,expectedValue:room.currentSolution[row][col],boardFilledCells:room.currentBoard.flat().filter(v=>v!==0).length,emptyCells:81-room.currentBoard.flat().filter(v=>v!==0).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion

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
    // #region agent log
    try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:140',message:'Checking for win completion',data:{roomId,playerId,boardFilledCells:updatedRoom.currentBoard.flat().filter(v=>v!==0).length,totalCells:81},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    const isWin = GameValidation.isPuzzleComplete(updatedRoom.currentBoard);
    // #region agent log
    try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:143',message:'Win check result',data:{roomId,playerId,isWin,gameStatus:updatedRoom.gameStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
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
      
      // #region agent log
      try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:159',message:'Win detected - setting game finished',data:{roomId,playerId,winner:updatedRoom.winner,player1Score,player2Score,gameStatus:updatedRoom.gameStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
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

  const completed = updatedRoom.gameStatus === 'finished';
  // #region agent log
  try{const logPath=path.join(process.cwd(),'.cursor','debug.log');const logData={location:'versusPlaceNumber.js:225',message:'Returning response with completion status',data:{roomId,playerId,completed,gameStatus:updatedRoom.gameStatus,winner:updatedRoom.winner,hasPlayers:!!updatedRoom.players?.player1&&!!updatedRoom.players?.player2},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  return {
    success: true,
    state: updatedRoomWithVersion,
    scoreDelta,
    modals,
    notification,
    completed,
    version: result.version
  };
}

