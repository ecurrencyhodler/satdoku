import { useCallback } from 'react';

/**
 * Hook for handling cell input in versus mode
 */
export function useVersusCellInput(
  roomId,
  selectedCell,
  gameState,
  setGameState,
  onWin,
  onGameOver,
  onPurchaseLife,
  isLoadingState,
  noteMode
) {
  const handleCellInput = useCallback(async (value) => {
    if (!selectedCell || !gameState || (typeof isLoadingState === 'function' ? isLoadingState() : isLoadingState) || gameState.isSpectator) {
      return;
    }

    // Support both single-player (gameStatus) and versus (status) game states
    const currentStatus = gameState.status || gameState.gameStatus;
    if (currentStatus !== 'active' && currentStatus !== 'playing') {
      return;
    }

    if (noteMode) {
      // Handle note toggle
      try {
        const response = await fetch('/api/versus/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'toggleNote',
            roomId,
            row: selectedCell.row,
            col: selectedCell.col,
            value
          })
        });

        const result = await response.json();
      if (result.success && result.state) {
        const { transformVersusStateToClient } = await import('../../lib/game/versusGameStateClient.js');
        const clientState = transformVersusStateToClient(result.state, gameState.playerId);
        setGameState(clientState);
      }
      } catch (error) {
        console.error('[useVersusCellInput] Error toggling note:', error);
      }
      return;
    }

    // Handle number placement
    try {
      const response = await fetch('/api/versus/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'placeNumber',
          roomId,
          row: selectedCell.row,
          col: selectedCell.col,
          value
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        if (result.errorCode === 'CELL_CONFLICT' || result.errorCode === 'CELL_ALREADY_FILLED') {
          // Show feedback that cell was already filled
          console.log('Cell was already filled by another player');
          // Could show a toast notification here
        } else if (result.errorCode === 'NO_LIVES') {
          if (onPurchaseLife) {
            onPurchaseLife();
          }
        }
        return;
      }

      if (result.state) {
        const { transformVersusStateToClient } = await import('../../lib/game/versusGameStateClient.js');
        const clientState = transformVersusStateToClient(result.state, gameState.playerId);
        setGameState(clientState);

        // Handle win condition
        if (result.completed && onWin) {
          const winnerData = result.state.winner === 'player1' 
            ? result.state.players.player1 
            : result.state.players.player2;
          const loserData = result.state.winner === 'player1' 
            ? result.state.players.player2 
            : result.state.players.player1;
          
          const winStatsData = {
            score: clientState.score,
            playerId: gameState.playerId,
            winner: result.state.winner,
            player1: result.state.players.player1,
            player2: result.state.players.player2
          };
          onWin(winStatsData);
        }

        // Handle purchase life modal
        if (result.modals?.purchaseLife && onPurchaseLife) {
          onPurchaseLife();
        }
      }
    } catch (error) {
      console.error('[useVersusCellInput] Error placing number:', error);
    }
  }, [selectedCell, gameState, roomId, setGameState, onWin, onPurchaseLife, isLoadingState, noteMode]);

  return { handleCellInput };
}

