import { useState, useEffect, useRef } from 'react';

/**
 * Hook for tracking which cells the opponent has filled
 * @param {object} gameState - Current game state
 * @param {boolean} isSpectator - Whether current user is a spectator
 * @returns {Set} Set of cell keys (e.g., "0,1") that opponent has filled
 */
export function useOpponentCellTracking(gameState, isSpectator) {
  const [opponentFilledCells, setOpponentFilledCells] = useState(new Set());
  const playerFilledCellsRef = useRef(new Set());
  const previousBoardRef = useRef(null);
  const lastMoveAttemptRef = useRef(null);

  // Reset player filled cells when game starts
  useEffect(() => {
    const currentStatus = gameState?.status || gameState?.gameStatus;
    if ((currentStatus === 'active' || currentStatus === 'playing') && previousBoardRef.current === null) {
      // Game just started, clear any previous tracking
      playerFilledCellsRef.current.clear();
    }
  }, [gameState?.gameStatus]);

  // Compute opponent-filled cells based on board state
  // A cell is opponent-filled if:
  // 1. It has a value (not 0)
  // 2. It's not prefilled (not in puzzle)
  // 3. It's NOT in our player-filled cells set
  // Spectators should never see orange cells, so skip this computation for them
  useEffect(() => {
    // Spectators should never see opponent-filled cells
    if (isSpectator) {
      setOpponentFilledCells(new Set());
      return;
    }

    if (!gameState?.board || !gameState?.puzzle) return;

    const board = gameState.board;
    const puzzle = gameState.puzzle;
    const opponentFilled = new Set();

    // Check if our last move attempt succeeded and add it to our filled cells
    if (lastMoveAttemptRef.current && previousBoardRef.current) {
      const { row, col, value } = lastMoveAttemptRef.current;
      const currentValue = board[row]?.[col] ?? 0;
      const previousValue = previousBoardRef.current[row]?.[col] ?? 0;
      
      // If the cell now has the value we tried to place, it was our move
      if (currentValue === value && previousValue !== value) {
        const cellKey = `${row},${col}`;
        playerFilledCellsRef.current.add(cellKey);
      }
    }

    // Clean up: if a cell in our filled set is now empty or changed, remove it
    for (const cellKey of playerFilledCellsRef.current) {
      const [row, col] = cellKey.split(',').map(Number);
      const currentValue = board[row]?.[col] ?? 0;
      // Remove if cell is now empty or doesn't match what we placed
      if (currentValue === 0) {
        playerFilledCellsRef.current.delete(cellKey);
      }
    }

    // Now identify opponent-filled cells
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = board[row]?.[col] ?? 0;
        const puzzleValue = puzzle[row]?.[col] ?? 0;
        const cellKey = `${row},${col}`;
        
        // A cell is opponent-filled if:
        // 1. It has a value
        // 2. It's not from the puzzle (prefilled)
        // 3. It's NOT in our filled cells set
        if (value !== 0 && puzzleValue === 0 && !playerFilledCellsRef.current.has(cellKey)) {
          opponentFilled.add(cellKey);
        }
      }
    }

    setOpponentFilledCells(opponentFilled);
    previousBoardRef.current = board.map(row => [...row]);
  }, [gameState?.board, gameState?.puzzle, isSpectator]);

  return {
    opponentFilledCells,
    trackMoveAttempt: (row, col, value) => {
      lastMoveAttemptRef.current = value !== 0 ? { row, col, value } : null;
    }
  };
}
