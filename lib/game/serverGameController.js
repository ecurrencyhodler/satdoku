import { getGameState, storeGameState } from '../redis/gameState.js';
import { saveCompletion } from '../redis/completions.js';
import { checkScoreQualifies } from '../redis/leaderboard.js';
import { BoardGenerator } from '../../src/js/core/boardGenerator.js';
import { DIFFICULTY_LEVELS, SCORE_VALUES, INITIAL_LIVES, BOARD_SIZE, BOX_SIZE } from '../../src/js/system/constants.js';

/**
 * Server-side game controller for processing actions
 */
export class ServerGameController {
  /**
   * Process a game action
   * @param {string} sessionId - Session ID
   * @param {object} action - Action object
   * @param {number|null} expectedVersion - Expected version for optimistic locking
   * @returns {Promise<object>} Result with state, modals, completion info
   */
  static async processAction(sessionId, action, expectedVersion = null) {
    // Load current state
    let state = await getGameState(sessionId);
    
    // Handle startNewGame action (can work without existing state)
    if (action.action === 'startNewGame') {
      return await this.handleStartNewGame(sessionId, action.difficulty || 'beginner', expectedVersion);
    }
    
    // All other actions require existing state
    if (!state) {
      return {
        success: false,
        error: 'No game state found. Please start a new game.',
        errorCode: 'GAME_NOT_FOUND'
      };
    }
    
    // Check version conflict
    const currentVersion = state.version || 0;
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      return {
        success: false,
        error: 'Version conflict - state was modified by another operation',
        errorCode: 'VERSION_CONFLICT',
        version: currentVersion
      };
    }
    
    // Process action based on type
    switch (action.action) {
      case 'placeNumber':
        return await this.handlePlaceNumber(sessionId, state, action, currentVersion);
      case 'clearCell':
        return await this.handleClearCell(sessionId, state, action, currentVersion);
      case 'keepPlaying':
        return await this.handleKeepPlaying(sessionId, state, currentVersion);
      case 'purchaseLife':
        return await this.handlePurchaseLife(sessionId, state, action, currentVersion);
      default:
        return {
          success: false,
          error: `Unknown action: ${action.action}`,
          errorCode: 'INVALID_ACTION'
        };
    }
  }
  
  /**
   * Handle startNewGame action
   */
  static async handleStartNewGame(sessionId, difficulty, expectedVersion) {
    const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    const { puzzle, solution } = boardGenerator.generatePuzzle(difficultyConfig);
    
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
      gameStartTime: new Date().toISOString()
    };
    
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
  
  /**
   * Handle placeNumber action
   */
  static async handlePlaceNumber(sessionId, state, action, currentVersion) {
    const { row, col, value } = action;
    
    // Validate action
    const validation = this.validatePlaceNumber(state, row, col, value);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: validation.errorCode || 'INVALID_MOVE',
        version: currentVersion
      };
    }
    
    // Check if player has lives
    if (state.lives <= 0) {
      return {
        success: false,
        error: 'No lives remaining. Please purchase a life to continue.',
        errorCode: 'NO_LIVES',
        version: currentVersion
      };
    }
    
    // Check if move is correct
    const isCorrect = state.currentSolution[row][col] === value;
    
    let updatedState;
    let scoreDelta = { points: 0, events: [] };
    let modals = { win: false, gameOver: false, purchaseLife: false };
    
    if (isCorrect) {
      // Process correct move - update board with correct value
      updatedState = {
        ...state,
        currentBoard: state.currentBoard.map((r, i) => 
          i === row ? r.map((c, j) => j === col ? value : c) : r
        )
      };
      
      const scoringResult = this.processCorrectMove(updatedState, row, col);
      updatedState.score = state.score + scoringResult.points;
      updatedState.moves = state.moves + 1;
      updatedState.completedRows = scoringResult.completedRows;
      updatedState.completedColumns = scoringResult.completedColumns;
      updatedState.completedBoxes = scoringResult.completedBoxes;
      scoreDelta = scoringResult.scoreDelta;
      
      // Check for win
      const isWin = this.isPuzzleComplete(updatedState.currentBoard);
      if (isWin) {
        return await this.handleWin(sessionId, updatedState, currentVersion, scoreDelta);
      }
    } else {
      // Process incorrect move - don't update board, just increment mistakes and decrement lives
      updatedState = {
        ...state,
        mistakes: state.mistakes + 1,
        lives: Math.max(0, state.lives - 1)
      };
      
      // Add error event to scoreDelta so client can show error animation
      scoreDelta = {
        points: 0,
        events: [{ type: 'error', row, col }]
      };
      
      // Check if lives reached 0
      if (updatedState.lives === 0) {
        modals.purchaseLife = true;
        // If no lives and can't purchase, show game over
        // (For now, we'll let the client handle this based on purchaseLife modal)
      }
    }
    
    // Save updated state
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
      scoreDelta,
      modals,
      completed: false,
      completionId: null,
      qualifiedForLeaderboard: false,
      version: result.version
    };
  }
  
  /**
   * Handle clearCell action
   */
  static async handleClearCell(sessionId, state, action, currentVersion) {
    const { row, col } = action;
    
    // Validate action
    if (state.currentPuzzle[row][col] !== 0) {
      return {
        success: false,
        error: 'Cannot clear prefilled cell',
        errorCode: 'INVALID_MOVE',
        version: currentVersion
      };
    }
    
    // Create updated state
    const updatedState = {
      ...state,
      currentBoard: state.currentBoard.map((r, i) => 
        i === row ? r.map((c, j) => j === col ? 0 : c) : r
      )
    };
    
    // Save updated state
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
  
  /**
   * Handle keepPlaying action
   */
  static async handleKeepPlaying(sessionId, state, currentVersion) {
    // Generate new puzzle while preserving stats
    const difficultyConfig = DIFFICULTY_LEVELS[state.difficulty] || DIFFICULTY_LEVELS.beginner;
    const boardGenerator = new BoardGenerator();
    const { puzzle, solution } = boardGenerator.generatePuzzle(difficultyConfig);
    
    const updatedState = {
      ...state,
      currentPuzzle: puzzle,
      currentSolution: solution,
      currentBoard: puzzle.map(row => [...row]),
      completedRows: [],
      completedColumns: [],
      completedBoxes: []
      // Preserve: score, moves, mistakes, lives, livesPurchased, difficulty, gameStartTime
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
  
  /**
   * Handle purchaseLife action
   */
  static async handlePurchaseLife(sessionId, state, action, currentVersion) {
    // TODO: Verify payment session ID
    // For now, just add a life
    const updatedState = {
      ...state,
      lives: state.lives + 1,
      livesPurchased: (state.livesPurchased || 0) + 1
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
  
  /**
   * Handle win condition
   */
  static async handleWin(sessionId, state, currentVersion, scoreDelta) {
    // Validate board is complete and correct
    if (!this.isPuzzleComplete(state.currentBoard) || 
        !this.boardMatchesSolution(state.currentBoard, state.currentSolution)) {
      // Should not happen, but handle gracefully
      return {
        success: false,
        error: 'Board validation failed',
        errorCode: 'NETWORK_ERROR',
        version: currentVersion
      };
    }
    
    // Calculate duration
    const gameStartTime = new Date(state.gameStartTime || new Date().toISOString());
    const completedAt = new Date();
    const duration = Math.floor((completedAt - gameStartTime) / 1000);
    
    // Check if score qualifies for leaderboard
    const qualifies = await checkScoreQualifies(state.score);
    
    // Generate completion ID
    const completionId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create completion record
    const completion = {
      completionId,
      sessionId,
      score: state.score,
      difficulty: state.difficulty,
      mistakes: state.mistakes,
      moves: state.moves,
      duration,
      completedAt: completedAt.toISOString(),
      eligibleForLeaderboard: qualifies,
      submittedToLeaderboard: false
    };
    
    // Save completion
    await saveCompletion(completion);
    
    // Update state to mark game as complete
    const updatedState = {
      ...state,
      gameInProgress: false
    };
    
    const result = await storeGameState(sessionId, updatedState, currentVersion);
    
    if (!result.success) {
      // Even if state save fails, completion is saved, so return success
      console.error('[ServerGameController] Failed to save state after win, but completion saved');
    }
    
    return {
      success: true,
      state: { ...updatedState, version: result.version || currentVersion },
      scoreDelta,
      modals: { win: true, gameOver: false, purchaseLife: false },
      completed: true,
      completionId,
      qualifiedForLeaderboard: qualifies,
      version: result.version || currentVersion
    };
  }
  
  /**
   * Validate placeNumber action
   */
  static validatePlaceNumber(state, row, col, value) {
    // Check bounds
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { valid: false, error: 'Invalid cell coordinates', errorCode: 'INVALID_MOVE' };
    }
    
    // Check value range
    if (value < 1 || value > 9) {
      return { valid: false, error: 'Invalid value (must be 1-9)', errorCode: 'INVALID_MOVE' };
    }
    
    // Check if cell is prefilled
    if (state.currentPuzzle[row][col] !== 0) {
      return { valid: false, error: 'Cannot place number in prefilled cell', errorCode: 'INVALID_MOVE' };
    }
    
    return { valid: true };
  }
  
  /**
   * Process correct move and calculate score
   */
  static processCorrectMove(state, row, col) {
    const events = [];
    let points = 0;
    const completedRows = [...state.completedRows];
    const completedColumns = [...state.completedColumns];
    const completedBoxes = [...state.completedBoxes];
    
    // Check for row completion
    if (!completedRows.includes(row) && this.isRowComplete(state.currentBoard, row)) {
      completedRows.push(row);
      points += SCORE_VALUES.completeRow;
      events.push({
        type: 'row',
        row,
        score: SCORE_VALUES.completeRow
      });
    }
    
    // Check for column completion
    if (!completedColumns.includes(col) && this.isColumnComplete(state.currentBoard, col)) {
      completedColumns.push(col);
      points += SCORE_VALUES.completeColumn;
      events.push({
        type: 'column',
        column: col,
        score: SCORE_VALUES.completeColumn
      });
    }
    
    // Check for box completion
    const boxIndex = this.getBoxIndex(row, col);
    if (!completedBoxes.includes(boxIndex) && this.isBoxComplete(state.currentBoard, row, col)) {
      completedBoxes.push(boxIndex);
      points += SCORE_VALUES.completeBox;
      events.push({
        type: 'box',
        boxIndex,
        score: SCORE_VALUES.completeBox
      });
    }
    
    // Always add point for correct cell
    points += SCORE_VALUES.correctCell;
    events.push({
      type: 'cell',
      row,
      col,
      score: SCORE_VALUES.correctCell
    });
    
    return {
      points,
      events,
      completedRows,
      completedColumns,
      completedBoxes
    };
  }
  
  /**
   * Check if puzzle is complete
   */
  static isPuzzleComplete(board) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === 0) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Check if board matches solution
   */
  static boardMatchesSolution(board, solution) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] !== solution[row][col]) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Check if row is complete
   */
  static isRowComplete(board, row) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Check if column is complete
   */
  static isColumnComplete(board, col) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Check if box is complete
   */
  static isBoxComplete(board, row, col) {
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    
    for (let i = boxRow; i < boxRow + BOX_SIZE; i++) {
      for (let j = boxCol; j < boxCol + BOX_SIZE; j++) {
        if (board[i][j] === 0) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Get box index
   */
  static getBoxIndex(row, col) {
    const boxRow = Math.floor(row / BOX_SIZE);
    const boxCol = Math.floor(col / BOX_SIZE);
    return boxRow * BOX_SIZE + boxCol;
  }
}
