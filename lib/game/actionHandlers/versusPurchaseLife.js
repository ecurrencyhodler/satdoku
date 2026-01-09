import { getRoom, updateRoomState } from '../../supabase/versusRooms.js';
import { isCheckoutProcessed, trackLifePurchase } from '../../supabase/purchases.js';
import { broadcastToWebSocket } from '../../websocket/broadcast.js';

/**
 * Handle purchaseLife action for versus mode
 * Must credit life to the correct player (identified by sessionId)
 * @param {string} roomId - Room ID
 * @param {string} sessionId - Player's session ID
 * @param {object} action - Action with checkoutId
 * @returns {Promise<object>}
 */
export async function handleVersusPurchaseLife(roomId, sessionId, action) {
  const checkoutId = action.checkoutId;

  // Require checkoutId for idempotency and security
  if (!checkoutId || typeof checkoutId !== 'string' || checkoutId.trim() === '') {
    return {
      success: false,
      error: 'Checkout ID is required',
      errorCode: 'MISSING_CHECKOUT_ID'
    };
  }

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

  // Check idempotency
  const alreadyProcessed = await isCheckoutProcessed(checkoutId);
  if (alreadyProcessed) {
    console.log('[handleVersusPurchaseLife] Checkout already processed, skipping:', checkoutId);
    return {
      success: false,
      error: 'Checkout already processed',
      errorCode: 'ALREADY_PROCESSED'
    };
  }

  // Update only the purchasing player's lives
  const updatedRoom = {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        ...player,
        lives: player.lives + 1
      }
    }
  };

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

  // Track purchase in Supabase
  const purchaseTracked = await trackLifePurchase(checkoutId, sessionId, 'success');

  if (!purchaseTracked) {
    console.error('[handleVersusPurchaseLife] Failed to track purchase in Supabase, but state was updated. Checkout can be retried.');
    return {
      success: false,
      error: 'Failed to track purchase',
      errorCode: 'NETWORK_ERROR',
      version: result.version
    };
  }

  console.log('[handleVersusPurchaseLife] Purchase tracked and checkout marked as processed:', checkoutId);

  // Create notification for other players
  const notification = {
    type: 'life_purchased',
    playerName: player.name,
    playerId: playerId
  };

  // Broadcast purchase notification to all players
  const updatedRoomWithVersion = { ...updatedRoom, version: result.version };
  broadcastToWebSocket(roomId, {
    type: 'notification',
    notification,
    room: updatedRoomWithVersion
  });

  return {
    success: true,
    state: updatedRoomWithVersion,
    notification: notification,
    version: result.version
  };
}

