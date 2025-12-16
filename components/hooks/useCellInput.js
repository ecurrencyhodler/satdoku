import { useCallback } from 'react';
import { StateManager } from '../../src/js/system/localState.js';
import { ScoreAnimationHandler } from '../../src/js/ui/scoreAnimationHandler.js';
import { UIAnimations } from '../../src/js/ui/uiAnimations.js';

/**
 * Hook for handling cell input processing logic
 * Sends actions to server and processes server responses
 */
export function useCellInput(
  selectedCell,
  gameState,
  setGameState,
  onWin,
  onGameOver,
  onPurchaseLife,
  setCompletionId,
  setQualifiedForLeaderboard,
  isLoadingState
) {
  const handleCellInput = useCallback(async (value) => {
    // Prevent input during state reload
    if (isLoadingState?.current) {
      console.warn('[useCellInput] Input blocked - state is currently loading');
      return;
    }
    
    if (!selectedCell || !gameState) return;

    const row = selectedCell.row;
    const col = selectedCell.col;

    // Create action
    const action = value === 0
      ? { action: 'clearCell', row, col }
      : { action: 'placeNumber', row, col, value };

    try {
      const result = await StateManager.sendGameAction(action, gameState?.version);

      if (result.success) {
        // Transform server state to client format
        const transformedState = {
          board: result.state.currentBoard,
          puzzle: result.state.currentPuzzle,
          difficulty: result.state.difficulty,
          mistakes: result.state.mistakes,
          gameInProgress: result.state.gameInProgress,
          score: result.state.score,
          moves: result.state.moves,
          lives: result.state.lives,
          livesPurchased: result.state.livesPurchased || 0,
          completedRows: result.state.completedRows || [],
          completedColumns: result.state.completedColumns || [],
          completedBoxes: result.state.completedBoxes || [],
          version: result.state.version
        };
        setGameState(transformedState);

        // Show score animations or error animations
        // Defer DOM query until after React has rendered (fixes Brave browser on Android)
        if (result.scoreDelta?.events && result.scoreDelta.events.length > 0) {
          // Use requestAnimationFrame to wait for React to render, then a small timeout
          // to ensure DOM is fully updated (especially important for Brave browser on Android)
          requestAnimationFrame(() => {
            setTimeout(() => {
              try {
                const cellElement = document.querySelector(
                  `[data-row="${row}"][data-col="${col}"]`
                );
                if (cellElement) {
                  // Check if there's an error event
                  const hasError = result.scoreDelta.events.some(e => e.type === 'error');
                  if (hasError) {
                    // Show error animation (flash red)
                    UIAnimations.flashError(cellElement);
                  } else {
                    // Show score animations
                    ScoreAnimationHandler.showScoreAnimations(result.scoreDelta.events, cellElement);
                  }
                }
              } catch (error) {
                // Silently handle DOM errors to prevent crashes (especially on Brave Android)
                console.warn('[useCellInput] Error showing animations:', error);
              }
            }, 0);
          });
        }

        // Handle modals
        if (result.modals?.win) {
          const stats = {
            score: result.state.score,
            moves: result.state.moves,
            mistakes: result.state.mistakes,
            livesPurchased: result.state.livesPurchased
          };
          onWin(stats);
        }
        
        if (result.modals?.gameOver) {
          const stats = {
            score: result.state.score,
            moves: result.state.moves,
            mistakes: result.state.mistakes,
            livesPurchased: result.state.livesPurchased
          };
          onGameOver(stats);
        }
        
        if (result.modals?.purchaseLife) {
          onPurchaseLife();
        }

        // Store completionId if win
        if (result.completed && result.completionId) {
          setCompletionId(result.completionId);
          setQualifiedForLeaderboard(result.qualifiedForLeaderboard || false);
        }
      } else if (result.conflict) {
        // Version conflict - reload state
        console.warn('[useCellInput] Version conflict, reloading state');
        const currentState = await StateManager.loadGameState();
        if (currentState) {
          setGameState(currentState);
        }
        // Optionally show error to user
      } else {
        // Other error - show to user
        console.error('[useCellInput] Action failed:', result.error);
        // TODO: Show error message to user
      }
    } catch (error) {
      console.error('[useCellInput] Error sending action:', error);
      // TODO: Show error message to user
    }
  }, [selectedCell, gameState, setGameState, onWin, onGameOver, onPurchaseLife, setCompletionId, setQualifiedForLeaderboard, isLoadingState]);

  return { handleCellInput };
}
