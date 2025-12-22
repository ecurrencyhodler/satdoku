import { getGameState } from '../redis/gameState.js';
import { handleStartNewGame } from './actionHandlers/startNewGame.js';
import { handlePlaceNumber } from './actionHandlers/placeNumber.js';
import { handleClearCell } from './actionHandlers/clearCell.js';
import { handleKeepPlaying } from './actionHandlers/keepPlaying.js';
import { handlePurchaseLife } from './actionHandlers/purchaseLife.js';
import { handleToggleNote } from './actionHandlers/toggleNote.js';
import { handleClearNotes } from './actionHandlers/clearNotes.js';

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
      return await handleStartNewGame(sessionId, action.difficulty || 'beginner', expectedVersion);
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
        return await handlePlaceNumber(sessionId, state, action, currentVersion);
      case 'clearCell':
        return await handleClearCell(sessionId, state, action, currentVersion);
      case 'keepPlaying':
        return await handleKeepPlaying(sessionId, state, currentVersion);
      case 'purchaseLife':
        return await handlePurchaseLife(sessionId, state, action, currentVersion);
      case 'toggleNote':
        return await handleToggleNote(sessionId, state, action, currentVersion);
      case 'clearNotes':
        return await handleClearNotes(sessionId, state, action, currentVersion);
      default:
        return {
          success: false,
          error: `Unknown action: ${action.action}`,
          errorCode: 'INVALID_ACTION'
        };
    }
  }
}












