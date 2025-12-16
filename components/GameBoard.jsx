'use client';

import Cell from './Cell';
import { BOARD_SIZE } from '../src/js/system/constants.js';

export default function GameBoard({ 
  board, 
  puzzle, 
  selectedCell, 
  onCellClick,
  hasLives 
}) {
  const getBoxIndex = (row, col) => {
    const boxRow = Math.floor(row / 3);
    const boxCol = Math.floor(col / 3);
    return boxRow * 3 + boxCol;
  };

  if (!board || !Array.isArray(board)) {
    return <div>Error: Board is not properly initialized</div>;
  }
  
  if (!puzzle || !Array.isArray(puzzle)) {
    return <div>Error: Puzzle is not properly initialized</div>;
  }

  return (
    <div className="game-board-container">
      <div id="game-board" className="game-board">
        {Array.from({ length: BOARD_SIZE }, (_, row) => {
          // Defensive check: ensure board[row] exists
          if (!board[row] || !Array.isArray(board[row])) {
            // Return empty cells for this row to prevent crash
            return Array.from({ length: BOARD_SIZE }, (_, col) => (
              <Cell
                key={`${row}-${col}`}
                row={row}
                col={col}
                value={0}
                isPrefilled={false}
                isSelected={false}
                isHighlightedRow={false}
                isHighlightedColumn={false}
                isHighlightedBox={false}
                isHighlightedSameNumber={false}
                onClick={onCellClick}
                hasLives={hasLives}
              />
            ));
          }
          
          return Array.from({ length: BOARD_SIZE }, (_, col) => {
            const value = board[row]?.[col] ?? 0;
            const isPrefilled = puzzle?.[row]?.[col] !== 0;
            const isSelected = selectedCell?.row === row && selectedCell?.col === col;
            
            // Calculate highlighting based on selected cell
            let isHighlightedRow = false;
            let isHighlightedColumn = false;
            let isHighlightedBox = false;
            let isHighlightedSameNumber = false;
            
            if (selectedCell) {
              const selectedValue = board[selectedCell.row]?.[selectedCell.col] ?? 0;
              const isSelectedCellEmpty = selectedValue === 0;
              
              if (isSelectedCellEmpty) {
                // Empty cell: highlight row, column, and box
                isHighlightedRow = row === selectedCell.row;
                isHighlightedColumn = col === selectedCell.col;
                const selectedBoxIndex = getBoxIndex(selectedCell.row, selectedCell.col);
                const currentBoxIndex = getBoxIndex(row, col);
                isHighlightedBox = selectedBoxIndex === currentBoxIndex;
              } else {
                // Filled cell: highlight all cells with the same number
                isHighlightedSameNumber = value === selectedValue && value !== 0;
              }
            }

            return (
              <Cell
                key={`${row}-${col}`}
                row={row}
                col={col}
                value={value}
                isPrefilled={isPrefilled}
                isSelected={isSelected}
                isHighlightedRow={isHighlightedRow}
                isHighlightedColumn={isHighlightedColumn}
                isHighlightedBox={isHighlightedBox}
                isHighlightedSameNumber={isHighlightedSameNumber}
                onClick={onCellClick}
                hasLives={hasLives}
              />
            );
          });
        })}
      </div>
    </div>
  );
}

