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

    if (gameState.gameStatus !== 'playing') {
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusCellInput.js:54',message:'Making placeNumber API call',data:{roomId,row:selectedCell.row,col:selectedCell.col,value,gameStatus:gameState?.gameStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusCellInput.js:66',message:'Received placeNumber API response',data:{success:result.success,hasCompleted:result.completed,gameStatus:result.state?.gameStatus,winner:result.state?.winner,error:result.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
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

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusCellInput.js:88',message:'Checking win condition',data:{completed:result.completed,hasOnWin:!!onWin,gameStatus:result.state?.gameStatus,winner:result.state?.winner,hasPlayers:!!result.state?.players?.player1&&!!result.state?.players?.player2},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useVersusCellInput.js:103',message:'Calling onWin callback',data:{winStatsData:JSON.stringify(winStatsData),hasWinner:!!winStatsData.winner,hasPlayer1:!!winStatsData.player1,hasPlayer2:!!winStatsData.player2},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
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

